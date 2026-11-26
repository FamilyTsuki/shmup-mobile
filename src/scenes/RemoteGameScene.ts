import {GameObjects, Scene, Scenes} from "phaser";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveConstants from "../SaveConstants.ts";
import Backdrop from "../effects/Backdrop.ts";
import Effects from "../effects/Effects.ts";
import Sfx from "../audio/Sfx.ts";
import Music from "../audio/Music.ts";
import LocalInput from "../input/LocalInput.ts";
import type {CoopData} from "../gameData/CoopData.ts";
import GyroSensor from "../input/GyroSensor.ts";
import Net from "../net/Net.ts";
import type {FxEvent, HostMessage, Snapshot, SnapPlayer, SyncObject} from "../net/Protocol.ts";
import Timeline from "../net/Timeline.ts";
import NetworkInput from "../net/NetworkInput.ts";
import Settings from "../managers/Settings.ts";
import Progress from "../managers/Progress.ts";
import SaveManager from "../managers/SaveManager.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import {Polarity, POLARITY_STYLES} from "../gameData/PolarityData.ts";
import UiStyle from "../ui/UiStyle.ts";
import type {RunResultData} from "./MainGameScene.ts";

type BufferedSnapshot = {
    objects: Map<number, SyncObject>;
    players: SnapPlayer[];
};

/**
 * What a coop guest plays: the host runs the game, this scene draws the snapshots it sends,
 * replays its effects, and sends back this player's input.
 *
 * Other objects are replayed a little in the past on the host's clock (see Timeline), so they move smoothly
 * even when Wi-Fi delivers the snapshots in bursts.
 * The guest's own ship is moved right here and its position sent to the host: no lag on it.
 */
export default class RemoteGameScene extends Scene {
    /** How often the host sends a snapshot, see NetHost */
    private static readonly SNAPSHOT_INTERVAL_MS: number = 50;
    private static readonly SHIP_HALF_WIDTH: number = 38;
    private static readonly WASH_ALPHA: number = 0.05;

    private saveManager: SaveManager;
    private _backdrop: Backdrop;
    private _wash: GameObjects.Rectangle;
    private _effects: Effects;
    private _sfx: Sfx;
    private _input: LocalInput;
    private _textures: Map<number, string> = new Map();
    private _sprites: Map<number, GameObjects.Image> = new Map();
    private _labels: Map<number, GameObjects.Text> = new Map();
    private _timeline: Timeline<BufferedSnapshot> = new Timeline(RemoteGameScene.SNAPSHOT_INTERVAL_MS);
    private _localX: number | null = null;
    private _localY: number = 0;
    private _shipSpeed: number = 0.6;
    private _switches: number = 0;
    private _fire: boolean = false;
    private _sinceInput: number = 0;

    constructor() {
        super(GameConstants.SceneKeys.REMOTE_GAME);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.saveManager.load();
        this._textures.clear();
        this._sprites.clear();
        this._labels.clear();
        this._timeline = new Timeline(RemoteGameScene.SNAPSHOT_INTERVAL_MS);
        this._localX = null;
        this._switches = 0;

        const ships = this.cache.json.get(GameConstants.DataKeys.PLAYER_SHIPS) as PlayerShipsData;
        this._shipSpeed = ships[Progress.getSelectedShip(this.saveManager)]?.movementSpeed ?? this._shipSpeed;

        // Under the HUD, which starts first
        this.scene.sendToBack();
        this._backdrop = new Backdrop(this);
        this._wash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, POLARITY_STYLES.ion.color,
            RemoteGameScene.WASH_ALPHA).setOrigin(0);
        this._effects = new Effects(this);
        this._sfx = new Sfx(this.sound);
        Music.play(this.sound, 'level');

        const controls = Settings.getControls(this.saveManager);
        if (controls.mode === 'gyro')
            GyroSensor.calibrate();
        this._input = new LocalInput(this, controls.mode === 'gyro' ? controls.gyro : undefined);

        Net.on(Net.MESSAGE_EVENT, this.onMessage, this);
        this.game.events.on(GameConstants.Events.BOMB_REQUESTED_EVENT, this.requestBomb, this);
        this.game.events.on(GameConstants.Events.POLARITY_REQUESTED_EVENT, this.requestSwitch, this);
        this.game.events.on(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.openMenu, this);
        this.game.events.on(GameConstants.Events.CONTROLS_CHANGED_EVENT, this.onControlsChanged, this);
        this.input.keyboard?.on('keydown-B', this.requestBomb, this);
        this.input.keyboard?.on('keydown-ESC', this.openMenu, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            Net.off(Net.MESSAGE_EVENT, this.onMessage, this);
            this.game.events.off(GameConstants.Events.BOMB_REQUESTED_EVENT, this.requestBomb, this);
            this.game.events.off(GameConstants.Events.POLARITY_REQUESTED_EVENT, this.requestSwitch, this);
            this.game.events.off(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.openMenu, this);
            this.game.events.off(GameConstants.Events.CONTROLS_CHANGED_EVENT, this.onControlsChanged, this);
            this._input.destroy();
        });
    }

    private requestBomb() {
        Net.sendToHost({k: 'bomb'});
    }

    private requestSwitch() {
        this._switches++;
    }

    /** The game goes on on the host: the menu only offers to leave */
    /** The options were changed from the menu */
    private onControlsChanged() {
        const controls = Settings.getControls(this.saveManager);
        this._input.applyControls(controls.mode === 'gyro' ? controls.gyro : undefined);
    }

    private openMenu() {
        if (!this.scene.isActive())
            return;
        this.scene.pause();
        this.scene.launch(GameConstants.SceneKeys.PAUSE, {gameKey: GameConstants.SceneKeys.REMOTE_GAME});
    }

    private onMessage(_from: number, data: HostMessage) {
        switch (data.k) {
            case 'snap':
                this.receiveSnapshot(data.s);
                break;
            case 'fx':
                data.e.forEach(event => this.replay(event));
                break;
            case 'end':
                this.finish(data.result);
                break;
        }
    }

    private receiveSnapshot(snapshot: Snapshot) {
        snapshot.keys?.forEach(([index, key]) => this._textures.set(index, key));
        this._timeline.push(snapshot.t, {
            objects: new Map(snapshot.objects.map(object => [object[0], object])),
            players: snapshot.players,
        });

        const registry = this.registry;
        const hud = snapshot.hud;
        registry.set(RegistryConstants.Keys.PLAYER_SCORE, hud.score);
        registry.set(RegistryConstants.Keys.COMBO, hud.combo);
        registry.set(RegistryConstants.Keys.RUN_CREDITS, hud.credits);
        registry.set(RegistryConstants.Keys.BOMBS, hud.bombs);
        registry.set(RegistryConstants.Keys.KILLS, hud.kills);
        registry.set(RegistryConstants.Keys.BOSS_NAME, hud.bossName);
        registry.set(RegistryConstants.Keys.BOSS_POLARITY, hud.bossPolarity);
        registry.set(RegistryConstants.Keys.BOSS_HEALTH, hud.bossHealth);
        // The host has no music message: a boss on screen is enough to know
        if (hud.bossHealth >= 0)
            Music.play(this.sound, 'boss');

        const me = snapshot.players.find(player => player.id === Net.myId);
        if (me) {
            registry.set(RegistryConstants.Keys.LIVES, me.lives);
            registry.set(RegistryConstants.Keys.RESONANCE, me.resonance);
            registry.set(RegistryConstants.Keys.POLARITY, me.polarity);
            if (this._localX === null) {
                const ship = snapshot.objects.find(object => object[0] === me.objects[0]);
                this._localX = ship?.[2] ?? this.scale.width / 2;
                this._localY = ship?.[3] ?? this.scale.height - GameConstants.PLAYER_Y_FROM_BOTTOM;
            }
        }
    }

    /** Plays on this screen an effect recorded on the host */
    private replay([target, method, args, peer]: FxEvent) {
        if (peer !== undefined && peer !== Net.myId)
            return;

        const call = (object: object) => {
            const fn = (object as Record<string, unknown>)[method];
            if (typeof fn === 'function')
                fn.apply(object, args);
        };
        switch (target) {
            case 'effects':
                call(this._effects);
                break;
            case 'sfx':
                call(this._sfx);
                break;
            case 'sound':
                this.sound.play(args[0] as string, args[1] as Phaser.Types.Sound.SoundConfig);
                break;
            case 'camera':
                if (method === 'flash')
                    this.cameras.main.flash(...(args as [number, number, number, number]));
                else
                    this.cameras.main.shake(...(args as [number, number]));
                break;
            case 'hud': {
                const events: { [kind: string]: string } = {banner: GameConstants.Events.BANNER_EVENT,
                    hint: GameConstants.Events.HINT_EVENT, dialogue: GameConstants.Events.DIALOGUE_EVENT};
                this.game.events.emit(events[method], ...args);
                break;
            }
            case 'scene':
                if (method === 'wash')
                    this.washScreen(args[0] as Polarity);
                break;
        }
    }

    private washScreen(polarity: Polarity) {
        this._wash.setFillStyle(POLARITY_STYLES[polarity].color, RemoteGameScene.WASH_ALPHA * 3);
        this.tweens.killTweensOf(this._wash);
        this.tweens.add({targets: this._wash, fillAlpha: RemoteGameScene.WASH_ALPHA, duration: 300});
    }

    /** Results are the host's; credits and best score go to this device's save */
    private finish(result: RunResultData) {
        Progress.addCredits(this.saveManager, result.credits);
        if (result.victory)
            Progress.unlockLevel(this.saveManager, result.level + 1);
        const best = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const newBestScore = result.score > best;
        if (newBestScore)
            this.saveManager.setData(SaveConstants.Keys.PLAYER_BEST_SCORE, result.score);
        this.scene.start(GameConstants.SceneKeys.GAME_OVER, {...result, newBestScore});
    }

    update(_time: number, deltaTime: number) {
        this._backdrop.update(deltaTime);
        this.moveOwnShip(deltaTime);
        this.sendInput(deltaTime);
        this.draw();
    }

    private moveOwnShip(deltaTime: number) {
        const state = this._input.poll();
        this._fire = state.fire;
        if (state.switchPolarity)
            this._switches++;
        if (this._localX === null)
            return;

        this._localX += state.moveX * this._shipSpeed * deltaTime + state.dragX;
        this._localX = Phaser.Math.Clamp(this._localX, RemoteGameScene.SHIP_HALF_WIDTH,
            this.scale.width - RemoteGameScene.SHIP_HALF_WIDTH);
        const bounds = GameConstants.playerYBounds(this.scale.height);
        this._localY = Phaser.Math.Clamp(this._localY + state.moveY * this._shipSpeed * deltaTime + state.dragY,
            bounds.min, bounds.max);
    }

    private sendInput(deltaTime: number) {
        this._sinceInput += deltaTime;
        if (!Timeline.due(this._sinceInput, NetworkInput.SEND_INTERVAL_MS) || this._localX === null)
            return;
        this._sinceInput = Math.max(0, this._sinceInput - NetworkInput.SEND_INTERVAL_MS);
        Net.sendToHost({k: 'input', s: {t: Math.round(performance.now()), x: Math.round(this._localX), y: Math.round(this._localY), fire: this._fire,
            switches: this._switches}});
        this._switches = 0;
    }

    /**
     * Blends the two snapshots around the time drawn.
     */
    private draw() {
        const sample = this._timeline.sample();
        if (!sample)
            return;
        const {older, newer, blend} = sample;

        const me = newer.players.find(player => player.id === Net.myId);
        // A ghost is still moved by its player
        const ownObjects = new Set(me?.alive || me?.ghost ? me.objects : []);
        // The other players' ships are see-through, so this player's own ship stands out
        const otherAlpha = (this.cache.json.get(GameConstants.DataKeys.COOP) as CoopData).otherPlayersAlpha;
        const otherObjects = new Set(newer.players.filter(player => player.id !== Net.myId).flatMap(player => player.objects));

        const seen = new Set<number>();
        newer.objects.forEach((object, id) => {
            seen.add(id);
            const previous = older.objects.get(id) ?? object;
            const sprite = this.spriteFor(object);
            if (!sprite)
                return;

            const own = ownObjects.has(id) && this._localX !== null;
            const x = own ? this._localX! : Phaser.Math.Linear(previous[2], object[2], blend);
            const y = own ? this._localY : Phaser.Math.Linear(previous[3], object[3], blend);
            // Shortest way around the circle
            const fromAngle = previous[4] / 100;
            const rotation = fromAngle + Phaser.Math.Angle.Wrap(object[4] / 100 - fromAngle) * blend;
            sprite.setPosition(x, y)
                .setRotation(rotation)
                .setScale(object[5] / 100, object[6] / 100)
                .setAlpha(object[7] / 100 * (otherObjects.has(id) || this.isOthersShot(object, me) ? otherAlpha : 1))
                .setDepth(object[10])
                .setVisible(true);
            if (object[9])
                sprite.setTintFill(0xffffff);
            else
                sprite.setTint(object[8]);
        });

        // Whatever the host stopped drawing
        this._sprites.forEach((sprite, id) => {
            if (!seen.has(id))
                sprite.setVisible(false);
        });

        this.drawLabels(newer.players);
    }

    /** A shot fired by another player than this one */
    private isOthersShot(object: SyncObject, me: SnapPlayer | undefined): boolean {
        const owner = object[11];
        return owner !== undefined && owner >= 0 && owner !== me?.index;
    }

    private spriteFor(object: SyncObject): GameObjects.Image | null {
        const key = this._textures.get(object[1]);
        if (!key)
            return null;

        let sprite = this._sprites.get(object[0]);
        if (!sprite) {
            sprite = this.add.image(object[2], object[3], key);
            this._sprites.set(object[0], sprite);
        } else if (sprite.texture.key !== key) {
            sprite.setTexture(key);
        }
        return sprite;
    }

    /** P1..P4 under each ship */
    private drawLabels(players: SnapPlayer[]) {
        if (players.length < 2)
            return;

        for (const player of players) {
            let label = this._labels.get(player.id);
            if (!label) {
                label = this.add.text(0, 0, `P${player.index + 1}`, UiStyle.text(30)).setOrigin(0.5).setDepth(12);
                this._labels.set(player.id, label);
            }
            const ship = this._sprites.get(player.objects[0]);
            label.setVisible((player.alive || player.ghost) && ship !== undefined)
                .setText(player.ghost ? `P${player.index + 1} FANTOME` : `P${player.index + 1}`)
                .setColor(player.ghost ? '#b9c7ff' : POLARITY_STYLES[player.polarity].lightCss);
            if (ship)
                label.setPosition(ship.x, ship.y + 70);
        }
    }
}
