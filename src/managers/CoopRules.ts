import {Scene, Scenes} from "phaser";
import Player from "../entities/Player.ts";
import type EntityManager from "./EntityManager.ts";
import type Effects from "../effects/Effects.ts";
import type Sfx from "../audio/Sfx.ts";
import type ScoreManager from "./ScoreManager.ts";
import type {CoopData} from "../gameData/CoopData.ts";
import {Polarity, POLARITY_STYLES} from "../gameData/PolarityData.ts";

/** How a rule talks to the players: a short message for one of them */
export type CoopHint = (player: Player, text: string) => void;

/**
 * What only exists with two players or more, all meant to make players shout at each other:
 * - a dead player becomes a ghost: it slows enemies, scares them with a tap, and comes back by touching an ally
 * - two ships touching high-five and get resonance
 * - two bursts released together merge into a huge one
 */
export default class CoopRules {
    /** (a: Player, b: Player) emitted on the scene events after a high-five */
    public static readonly HIGH_FIVE_EVENT: string = 'coopHighFive';

    private static readonly DEATH_LINES: string[] = ['OUPS', 'ADIEU...', "J'REVIENS", 'CA PIQUE', 'AU SECOURS'];
    private static readonly REVIVE_LINES: string[] = ['DEBOUT !', 'RESSUSCITE !', "C'EST REPARTI", 'MERCI !'];
    private static readonly BOO_LINES: string[] = ['BOU !', 'BOUH !!', 'HOU HOU'];
    private static readonly REVIVE_RING_MS: number = 250;
    private static readonly SCARED_MARKS: number = 6;
    private static readonly SLOW_REFRESH_MS: number = 150;

    private readonly _scene: Scene;
    private readonly _data: CoopData;
    private readonly _entities: EntityManager;
    private readonly _effects: Effects;
    private readonly _sfx: Sfx;
    private readonly _score: ScoreManager;
    private readonly _hint: CoopHint;
    private readonly _reviveProgress: Map<Player, number> = new Map();
    private readonly _lastBoo: Map<Player, number> = new Map();
    /** Pairs that high-fived, until they move apart: "1-2" */
    private readonly _clapped: Map<string, number> = new Map();
    private _lastBurst: { player: Player, time: number, x: number, y: number } | null = null;
    private _sinceRing: number = 0;

    constructor(scene: Scene, data: CoopData, entities: EntityManager, effects: Effects, sfx: Sfx, score: ScoreManager,
                hint: CoopHint) {
        this._scene = scene;
        this._data = data;
        this._entities = entities;
        this._effects = effects;
        this._sfx = sfx;
        this._score = score;
        this._hint = hint;

        scene.events.on(Player.GHOST_BOO_EVENT, this.boo, this);
        scene.events.once(Scenes.Events.SHUTDOWN, () => scene.events.off(Player.GHOST_BOO_EVENT, this.boo, this));
    }

    /** Instead of exploding for good, the ship turns into a ghost */
    public onDeath(player: Player) {
        player.becomeGhost(this._data.ghost.alpha, Phaser.Display.Color.HexStringToColor(this._data.ghost.tint).color);
        this._effects.floatingText(player.x, player.y - 120, Phaser.Utils.Array.GetRandom(CoopRules.DEATH_LINES), '#b9c7ff');
        this._hint(player, 'Tu es un FANTOME !\nColle un allié pour revivre\nTape pour faire BOU !');
    }

    /**
     * @returns true when this burst completed a synchronized one
     */
    public onBurst(player: Player, polarity: Polarity): boolean {
        const now = this._scene.time.now;
        const previous = this._lastBurst;
        this._lastBurst = {player, time: now, x: player.x, y: player.y};
        if (!previous || previous.player === player || now - previous.time > this._data.syncBurst.windowMs)
            return false;

        this._lastBurst = null;
        const sync = this._data.syncBurst;
        const x = (previous.x + player.x) / 2;
        const y = (previous.y + player.y) / 2;
        const converted = this._entities.releaseBurst(x, y, sync.radius, sync.strength, polarity);
        this._score.addScore(sync.score + converted * 4);

        const style = POLARITY_STYLES[polarity];
        this._effects.ring(x, y, style.color, sync.radius, 700);
        this._effects.ring(x, y, 0xffffff, sync.radius * 0.6, 550);
        this._effects.ring(x, y, POLARITY_STYLES[polarity === 'ion' ? 'plasma' : 'ion'].color, sync.radius * 0.35, 400);
        this._effects.floatingText(x, y - 220, 'BASCULE SYNCHRO !', '#f6d55c');
        this._sfx.burst(1);
        this._sfx.clap();
        return true;
    }

    public update(deltaTime: number) {
        const now = this._scene.time.now;
        const alive = this._entities.alivePlayers;
        const ghosts = this._entities.players.filter(player => player.active && player.isGhost);

        this.slowAroundGhosts(ghosts);
        this.reviveGhosts(ghosts, alive, deltaTime);
        this.highFive(alive, now);
    }

    private slowAroundGhosts(ghosts: Player[]) {
        if (ghosts.length === 0)
            return;
        const ghost = this._data.ghost;
        for (const enemy of this._entities.activeEnemies()) {
            if (ghosts.some(player => Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y) < ghost.slowRadius))
                enemy.slow(ghost.slowFactor, CoopRules.SLOW_REFRESH_MS);
        }
    }

    private boo(player: Player) {
        const now = this._scene.time.now;
        const ghost = this._data.ghost;
        if (now - (this._lastBoo.get(player) ?? -Infinity) < ghost.booCooldownMs)
            return;
        this._lastBoo.set(player, now);

        this._sfx.boo();
        this._effects.ring(player.x, player.y, 0xb9c7ff, ghost.booRadius, 500);
        this._effects.floatingText(player.x, player.y - 120, Phaser.Utils.Array.GetRandom(CoopRules.BOO_LINES), '#b9c7ff');

        let marks = 0;
        for (const enemy of this._entities.activeEnemies()) {
            if (Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y) > ghost.booRadius)
                continue;
            enemy.scare(ghost.scareMs, ghost.scarePushPx);
            if (marks++ < CoopRules.SCARED_MARKS)
                this._effects.floatingText(enemy.x, enemy.y - 60, '!!', '#f6d55c');
        }
    }

    /** A ghost hugging a living ally comes back after a moment */
    private reviveGhosts(ghosts: Player[], alive: Player[], deltaTime: number) {
        const revive = this._data.revive;
        this._sinceRing += deltaTime;
        const ringNow = this._sinceRing >= CoopRules.REVIVE_RING_MS;
        if (ringNow)
            this._sinceRing = 0;

        for (const ghost of ghosts) {
            const helper = alive.find(ally => Phaser.Math.Distance.Between(ghost.x, ghost.y, ally.x, ally.y) < revive.distance);
            if (!helper) {
                this._reviveProgress.delete(ghost);
                continue;
            }

            const progress = (this._reviveProgress.get(ghost) ?? 0) + deltaTime;
            this._reviveProgress.set(ghost, progress);
            if (ringNow)
                this._effects.ring(ghost.x, ghost.y, 0xffffff, 40 + 80 * progress / revive.holdMs, 240);
            if (progress < revive.holdMs)
                continue;

            this._reviveProgress.delete(ghost);
            ghost.revive(revive.lives, revive.invulnerableMs);
            this._sfx.revive();
            this._effects.ring(ghost.x, ghost.y, 0xffffff, 260, 400);
            this._effects.floatingText(ghost.x, ghost.y - 120, Phaser.Utils.Array.GetRandom(CoopRules.REVIVE_LINES), '#7fcf8c');
            this._hint(helper, `Tu as sauvé P${ghost.index + 1} !`);
        }
    }

    /** Two ships touching: CLAP, both get resonance. Once per contact */
    private highFive(alive: Player[], now: number) {
        const highFive = this._data.highFive;
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a = alive[i];
                const b = alive[j];
                const pair = `${a.index}-${b.index}`;
                const distance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
                const lastClap = this._clapped.get(pair);

                // Moving apart re-arms the pair, once its cooldown is over
                if (lastClap !== undefined) {
                    if (distance > highFive.distance * 2 && now - lastClap > highFive.cooldownMs)
                        this._clapped.delete(pair);
                    continue;
                }
                if (distance > highFive.distance)
                    continue;

                this._clapped.set(pair, now);
                // Share the gauges, plus a bonus for both
                const shared = (a.charge + b.charge) / 2 + highFive.resonanceBonus;
                a.setCharge(shared);
                b.setCharge(shared);
                this._score.addScore(highFive.score);
                const x = (a.x + b.x) / 2;
                const y = (a.y + b.y) / 2;
                this._sfx.clap();
                this._effects.ring(x, y, 0xf6d55c, 140, 260);
                this._effects.floatingText(x, y - 130, 'CLAP !', '#f6d55c');
                this._scene.events.emit(CoopRules.HIGH_FIVE_EVENT, a, b);
            }
        }
    }
}
