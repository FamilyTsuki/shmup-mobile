import {Core, GameObjects, Input, Scene, Scenes} from 'phaser';
import Health from "../components/Health.ts";
import Boss from "../entities/Boss.ts";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import Sfx from "../audio/Sfx.ts";
import Music from "../audio/Music.ts";
import Effects from "../effects/Effects.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import EntityManager from "../managers/EntityManager.ts";
import WaveManager from "../managers/WaveManager.ts";
import ScoreManager from "../managers/ScoreManager.ts";
import Progress from "../managers/Progress.ts";
import GameConstants from "../GameConstants.ts";
import LocalInput from "../input/LocalInput.ts";
import GyroSensor from "../input/GyroSensor.ts";
import Settings from "../managers/Settings.ts";
import type {LevelData, LevelsData} from "../gameData/LevelData.ts";
import type {PowerUpsData, PowerUpType} from "../gameData/PowerUpData.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import {computePlayerStats, UpgradesData} from "../gameData/UpgradeData.ts";
import {Polarity, PolarityData, POLARITY_STYLES} from "../gameData/PolarityData.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";
import Net from "../net/Net.ts";
import NetHost from "../net/NetHost.ts";
import type {PlayerSetup} from "../managers/EntityManager.ts";
import CoopRules from "../managers/CoopRules.ts";
import type {CoopData} from "../gameData/CoopData.ts";
import {buildEndlessStage, EndlessData, EndlessRun} from "../gameData/EndlessData.ts";
import PlayerName from "../managers/PlayerName.ts";
import Leaderboard, {SubmitResult} from "../net/Leaderboard.ts";

export type MainGameSceneData = {
    /** Index in levels.json */
    level?: number;
    /** Set for a stage of the endless mode, which then ignores level */
    endless?: EndlessRun;
};

export type RunResultData = {
    level: number;
    victory: boolean;
    score: number;
    kills: number;
    credits: number;
    newBestScore: boolean;
    /** Endless mode only: the stage where the run ended */
    stage?: number;
};

/** Endless mode: the leaderboard answer to the score sent at the end of the run */
export type GameOverData = RunResultData & {
    submitted?: Promise<SubmitResult | null>;
};

export default class MainGameScene extends Scene {
    private static readonly END_DELAY_MS: number = 1000;
    private static readonly VICTORY_DELAY_MS: number = 3500;
    private static readonly LOOT_ATTRACT_DELAY_MS: number = 800;
    private static readonly PLAYER_EXPLOSION_COLOR: number = 0xffffff;
    /** Screen wash in the player polarity color */
    private static readonly WASH_ALPHA: number = 0.05;
    private static readonly PARTICLES_PER_SCALE: number = 22;
    private static readonly POWER_UP_LABELS: { [type in PowerUpType]: string } = {
        rapidFire: 'CADENCE +', multiShot: 'MULTI-TIR', shield: 'BOUCLIER', heal: '+1 VIE', bomb: '+1 BOMBE',
    };
    private static readonly BOSS_WARNING_MS: number = 2500;
    private static readonly DIFFICULTY_PER_EXTRA_PLAYER: number = 0.5;

    private _backdrop: Backdrop;
    private _wash: GameObjects.Rectangle;
    private _polarityData: PolarityData;
    private saveManager: SaveManager;
    private entityManager: EntityManager;
    private _levelIndex: number;
    private _level: LevelData;
    private _waveManager: WaveManager;
    private _scoreManager: ScoreManager;
    private _powerUps: PowerUpsData;
    private _boss: Boss | null;
    private _sfx: Sfx;
    private _effects: Effects;
    private _player: Player;
    private _ended: boolean;
    /** Set when this device hosts a coop game */
    private _netHost: NetHost | null = null;
    private _labels: Map<Player, GameObjects.Text> = new Map();
    /** Ghosts, high-fives and synchronized bursts: only with two players or more */
    private _coop: CoopRules | null = null;
    /** Enemies and bosses get tougher with each extra player */
    private _difficulty: number = 1;
    /** Endless mode: the run so far, null for a level of levels.json */
    private _endless: EndlessRun | null = null;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_GAME);
    }

    // noinspection JSUnusedGlobalSymbols
    init(data: MainGameSceneData) {
        const levels = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels;
        this._endless = data?.endless ?? null;
        this._levelIndex = Phaser.Math.Clamp(data?.level ?? 0, 0, levels.length - 1);
        this._level = this._endless
            ? buildEndlessStage(this.cache.json.get(GameConstants.DataKeys.ENDLESS) as EndlessData, this._endless.stage)
            : levels[this._levelIndex];
        this._ended = false;
        this._boss = null;
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.saveManager.load();
        this._powerUps = this.cache.json.get(GameConstants.DataKeys.POWER_UPS) as PowerUpsData;
        this._scoreManager = new ScoreManager(this);
        this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, -1);
        // Endless mode: the score and kills go on from the previous stage
        if (this._endless) {
            this.registry.set(RegistryConstants.Keys.PLAYER_SCORE, this._endless.score);
            this.registry.set(RegistryConstants.Keys.KILLS, this._endless.kills);
        }

        const upgrades = this.cache.json.get(GameConstants.DataKeys.UPGRADES) as UpgradesData;
        const shipId = Progress.getSelectedShip(this.saveManager);
        const ship = (this.cache.json.get(GameConstants.DataKeys.PLAYER_SHIPS) as PlayerShipsData)[shipId];
        const stats = computePlayerStats(upgrades, Progress.getUpgradeLevels(this.saveManager), ship?.bonus);
        this.registry.set(RegistryConstants.Keys.BOMBS, stats.bombs);

        this._polarityData = this.cache.json.get(GameConstants.DataKeys.POLARITY) as PolarityData;
        this.registry.set(RegistryConstants.Keys.RESONANCE, 0);
        this.registry.set(RegistryConstants.Keys.POLARITY, 'ion');

        this._backdrop = new Backdrop(this);
        this._wash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, POLARITY_STYLES.ion.color,
            MainGameScene.WASH_ALPHA).setOrigin(0);

        const controls = Settings.getControls(this.saveManager);
        if (controls.mode === 'gyro')
            GyroSensor.calibrate();
        const input = new LocalInput(this, controls.mode === 'gyro' ? controls.gyro : undefined);
        const onControlsChanged = () => {
            const changed = Settings.getControls(this.saveManager);
            input.applyControls(changed.mode === 'gyro' ? changed.gyro : undefined);
        };
        this.game.events.on(GameConstants.Events.CONTROLS_CHANGED_EVENT, onControlsChanged);

        this._sfx = new Sfx(this.sound);
        this._effects = new Effects(this);
        Music.play(this.sound, 'level');

        // Coop host: one more ship per guest, driven by its messages
        const setups: PlayerSetup[] = [{input, stats, shipId, peerId: 0}];
        this._netHost = Net.role === 'host' ? new NetHost(this) : null;
        if (this._netHost) {
            for (const {peerId, input: guestInput} of this._netHost.createInputs()) {
                const guest = Net.guests.get(peerId);
                setups.push({input: guestInput, stats: guest?.stats ?? stats, shipId: guest?.ship ?? 1, peerId});
            }
            this.recordForGuests();
        }
        this._difficulty = this._level.difficulty * (1 + MainGameScene.DIFFICULTY_PER_EXTRA_PLAYER * (setups.length - 1));

        const players = this.entityManager.spawnPlayers(setups);
        // "on": in coop a revived ship can die again
        players.forEach(ship => ship.getComponent(Health)?.on(Health.DEATH_EVENT, () => this.onPlayerDeath(ship), this));
        this._netHost?.setPlayers(players);
        if (players.length > 1) {
            this.dimOtherPlayers(players);
            players.forEach(ship => this._labels.set(ship, this.add.text(ship.x, ship.y + 70, `P${ship.index + 1}`,
                UiStyle.text(30, POLARITY_STYLES.ion.lightCss)).setOrigin(0.5).setDepth(12)));
        }

        this.entityManager.initEnemies();
        this.entityManager.initGroupCollisions();
        this._player = players[0];
        this._coop = players.length > 1
            ? new CoopRules(this, this.cache.json.get(GameConstants.DataKeys.COOP) as CoopData, this.entityManager,
                this._effects, this._sfx, this._scoreManager, (ship, text) => this.hintFor(ship, text))
            : null;
        this.events.on(CoopRules.HIGH_FIVE_EVENT, this.onHighFive, this);
        this.registry.set(RegistryConstants.Keys.LIVES, this._player.lives);
        this._player.getComponent(Health)?.on(Health.CHANGE_EVENT,
            (current: number) => this.registry.set(RegistryConstants.Keys.LIVES, current));
        this.events.on(EntityManager.CREDITS_COLLECTED_EVENT, this.onCreditsCollected, this);
        this.events.on(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
        this.events.on(Player.HIT_EVENT, this.onPlayerHit, this);
        this.events.on(Player.POWER_UP_EVENT, this.onPowerUp, this);
        this.events.on(Player.ABSORB_EVENT, this.onAbsorb, this);
        this.events.on(Player.POLARITY_SWITCH_EVENT, this.onPolaritySwitch, this);
        this.events.on(Boss.POLARITY_CHANGED_EVENT, this.onBossPolarityChanged, this);
        this.events.on(Boss.SPEAK_EVENT, this.onBossSpeak, this);

        this._waveManager = new WaveManager(this, this.entityManager, {...this._level, difficulty: this._difficulty});
        this._waveManager.on(WaveManager.WAVE_STARTED_EVENT, (index: number, count: number, hint?: string) => {
            this.showBanner(this._endless ? `VAGUE ${index + 1}` : `VAGUE ${index + 1}/${count}`);
            if (hint)
                this.hud('hint', [hint]);
        });
        this._waveManager.on(WaveManager.ALL_WAVES_CLEARED_EVENT, () => {
            this.showBanner('ALERTE\nBOSS EN APPROCHE');
            this.camera('flash', [300, 120, 0, 0]);
            this._sfx.alarm();
            this.time.delayedCall(MainGameScene.BOSS_WARNING_MS, () => this.spawnBoss());
        });

        if (this.input.keyboard) {
            if (!this._netHost && !this._endless)
                this.input.keyboard.addKey(Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC).on('down', this.pauseGame, this);
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.P).on('down', this.pauseGame, this);
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.B).on('down', this.useBomb, this);
        }

        // Pause when the player switches app, locks the phone or changes tab
        this.game.events.on(Core.Events.HIDDEN, this.pauseGame, this);
        this.game.events.on(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.pauseGame, this);
        this.game.events.on(GameConstants.Events.BOMB_REQUESTED_EVENT, this.useBomb, this);
        this.game.events.on(GameConstants.Events.POLARITY_REQUESTED_EVENT, this.requestPolaritySwitch, this);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.BOMB_REQUESTED_EVENT, this.useBomb, this);
            this.game.events.off(GameConstants.Events.POLARITY_REQUESTED_EVENT, this.requestPolaritySwitch, this);
            this.events.off(EntityManager.CREDITS_COLLECTED_EVENT, this.onCreditsCollected, this);
            this.events.off(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
            this.events.off(Player.HIT_EVENT, this.onPlayerHit, this);
            this.events.off(Player.POWER_UP_EVENT, this.onPowerUp, this);
            this.events.off(Player.ABSORB_EVENT, this.onAbsorb, this);
            this.events.off(Player.POLARITY_SWITCH_EVENT, this.onPolaritySwitch, this);
            this.events.off(Boss.POLARITY_CHANGED_EVENT, this.onBossPolarityChanged, this);
            this.events.off(Boss.SPEAK_EVENT, this.onBossSpeak, this);
            this.events.off(CoopRules.HIGH_FIVE_EVENT, this.onHighFive, this);
            this._coop = null;
            this._scoreManager.destroy();
            this.game.events.off(Core.Events.HIDDEN, this.pauseGame, this);
            this.game.events.off(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.pauseGame, this);
            this._waveManager.removeAllListeners();
            this.events.off(Boss.PHASE_CHANGED_EVENT);
            this.events.off(Boss.DEFEATED_EVENT);
            this.game.events.off(GameConstants.Events.CONTROLS_CHANGED_EVENT, onControlsChanged);
            input.destroy();
            this._netHost?.destroy();
            this._netHost = null;
            this._labels.clear();
        });

        this.showBanner(this._endless ? `ETAPE ${this._endless.stage}`
            : `NIVEAU ${this._levelIndex + 1}\n${this._level.name}`);
        this.time.delayedCall(MainGameScene.VICTORY_DELAY_MS, () => this._waveManager.start());
    }

    /**
     * The guests' ships are drawn see-through on this screen only: a layer dims them without touching
     * their own alpha, which the guests receive in the snapshots.
     */
    private dimOtherPlayers(players: Player[]) {
        const alpha = (this.cache.json.get(GameConstants.DataKeys.COOP) as CoopData).otherPlayersAlpha;
        const layer = this.add.layer().setAlpha(alpha).setDepth(players[0].depth);
        players.slice(1).forEach(ship => {
            layer.add([ship, ...ship.followers]);
            // Their shots too; NetHost sends them undimmed with their owner, each guest dims the others' ones
            ship.setShotAlpha(alpha);
        });
    }

    private spawnBoss() {
        const boss = this.entityManager.spawnBoss(this._level.boss, this._difficulty);
        Music.play(this.sound, 'boss');
        this._boss = boss;
        this.registry.set(RegistryConstants.Keys.BOSS_NAME, boss.bossData.name);
        this.registry.set(RegistryConstants.Keys.BOSS_POLARITY, boss.polarity);
        this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, 1);

        boss.getComponent(Health)?.on(Health.CHANGE_EVENT, () => {
            this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, boss.healthRatio);
        });
        this.events.on(Boss.PHASE_CHANGED_EVENT, (phaseIndex: number) => {
            if (phaseIndex > 0) {
                this.showBanner(`PHASE ${phaseIndex + 1}`);
                this.camera('shake', [300, 0.015]);
            }
        });
        this.events.once(Boss.DEFEATED_EVENT, () => {
            this._boss = null;
            this._sfx.explosion(true);
            this._effects.explosion(boss.x, boss.y, POLARITY_STYLES[boss.polarity].color, 120);
            this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, -1);
            this._scoreManager.addScore(boss.bossData.score);
            this.entityManager.dropCoins(boss.x, boss.y, this._powerUps.bossCreditCoins,
                Math.ceil(boss.bossData.score * this._powerUps.creditsPerScore / this._powerUps.bossCreditCoins));
            this.time.delayedCall(MainGameScene.LOOT_ATTRACT_DELAY_MS, () => this.entityManager.attractAllPickups());
            this.showBanner(this._endless ? 'ETAPE TERMINEE' : 'NIVEAU TERMINE');
            this.endRun(true, MainGameScene.VICTORY_DELAY_MS);
        });
    }

    private onCreditsCollected(credits: number) {
        this._scoreManager.addCredits(credits);
        this._sfx.coin();
    }

    private onEnemyKilled(enemy: Enemy) {
        const color = POLARITY_STYLES[enemy.polarity].color;
        this._effects.explosion(enemy.x, enemy.y, color, Math.round(MainGameScene.PARTICLES_PER_SCALE * enemy.scale));
        this._sfx.explosion();
    }

    private onAbsorb(x: number, y: number, charge: number, player: Player) {
        this._effects.absorb(x, y, POLARITY_STYLES[player.polarity].color);
        this._sfx.absorb(charge);
        this._scoreManager.addScore(this._polarityData.absorbScore);
        this._scoreManager.keepComboAlive();
        if (player === this._player)
            this.registry.set(RegistryConstants.Keys.RESONANCE, charge);
    }

    /** A ship is down: the run is lost once every ship is */
    private onPlayerDeath(player: Player) {
        this._effects.explosion(player.x, player.y, MainGameScene.PLAYER_EXPLOSION_COLOR, 60);
        this._effects.explosion(player.x, player.y, POLARITY_STYLES[player.polarity].color, 40);
        this._sfx.explosion(true);
        if (player === this._player)
            this.registry.set(RegistryConstants.Keys.RESONANCE, 0);
        if (this._coop)
            this._coop.onDeath(player);
        else
            player.disableBody(true, true);

        // Lost once nobody is left to revive the ghosts. Let the explosion play before the game over screen
        if (this.entityManager.alivePlayers.length === 0)
            this.endRun(false, MainGameScene.END_DELAY_MS);
    }

    /**
     * Every switch recolors the screen; a switch with enough resonance releases it as a burst
     * that turns nearby enemy bullets into player shots.
     */
    private onPolaritySwitch(polarity: Polarity, releasedCharge: number, player: Player) {
        const style = POLARITY_STYLES[polarity];
        const local = player === this._player;
        if (local) {
            this.registry.set(RegistryConstants.Keys.POLARITY, polarity);
            this.washScreen(polarity);
        } else {
            this._netHost?.fx('scene', 'wash', [polarity], player.peerId);
        }
        this._effects.ring(player.x, player.y, style.color, 120, 220);
        this._sfx.polaritySwitch(polarity === 'ion');

        if (releasedCharge <= 0)
            return;

        const burst = this._polarityData.burst;
        const strength = releasedCharge / Player.MAX_CHARGE;
        const radius = Phaser.Math.Linear(burst.minRadius, burst.maxRadius,
            (releasedCharge - burst.minCharge) / (Player.MAX_CHARGE - burst.minCharge));
        const converted = this.entityManager.releaseBurst(player.x, player.y, radius, strength, polarity);
        this._coop?.onBurst(player, polarity);

        if (local)
            this.registry.set(RegistryConstants.Keys.RESONANCE, 0);
        this._scoreManager.addScore(converted * this._polarityData.absorbScore * 2);
        this._effects.ring(player.x, player.y, style.color, radius, 450);
        this._effects.ring(player.x, player.y, 0xffffff, radius * 0.7, 350);
        this._effects.floatingText(player.x, player.y - 140,
            converted > 0 ? `BASCULE x${converted}` : 'BASCULE', style.css);
        this.camera('shake', [250, 0.008 + strength * 0.012]);
        this._sfx.burst(strength);
        if (local)
            navigator.vibrate?.(60);
    }

    /** The screen takes the color of the player polarity for a moment */
    public washScreen(polarity: Polarity) {
        this._wash.setFillStyle(POLARITY_STYLES[polarity].color, MainGameScene.WASH_ALPHA * 3);
        this.tweens.killTweensOf(this._wash);
        this.tweens.add({targets: this._wash, fillAlpha: MainGameScene.WASH_ALPHA, duration: 300});
    }

    private onHighFive(a: Player, b: Player) {
        if (a === this._player || b === this._player)
            this.registry.set(RegistryConstants.Keys.RESONANCE, this._player.charge);
    }

    /** A message for one player: on this screen, or sent to that guest */
    private hintFor(player: Player, text: string) {
        if (player === this._player)
            this.game.events.emit(GameConstants.Events.HINT_EVENT, text);
        else
            this._netHost?.fx('hud', 'hint', [text], player.peerId);
    }

    private onBossSpeak(speaker: string, lines: string[], lineMs: number) {
        this.hud('dialogue', [speaker, lines, lineMs]);
    }

    private onBossPolarityChanged(polarity: Polarity) {
        this.registry.set(RegistryConstants.Keys.BOSS_POLARITY, polarity);
    }

    /** Red flash and shake for the player who got hit only */
    private onPlayerHit(player: Player) {
        if (player === this._player) {
            this._sfx.playerHit();
            this.cameras.main.flash(150, 255, 40, 40);
            this.cameras.main.shake(100, 0.01);
            return;
        }
        this._netHost?.fx('sfx', 'playerHit', [], player.peerId);
        this._netHost?.fx('camera', 'flash', [150, 255, 40, 40], player.peerId);
        this._netHost?.fx('camera', 'shake', [100, 0.01], player.peerId);
    }

    private onPowerUp(type: PowerUpType, player: Player) {
        this._sfx.powerUp();
        this._effects.floatingText(player.x, player.y - 110, MainGameScene.POWER_UP_LABELS[type], '#ffd166');
    }

    private requestPolaritySwitch() {
        if (!this._ended && this.scene.isActive())
            this._player.requestPolaritySwitch();
    }

    private useBomb() {
        if (this._ended || !this.scene.isActive() || Number(this.registry.get(RegistryConstants.Keys.BOMBS)) <= 0)
            return;

        this.registry.inc(RegistryConstants.Keys.BOMBS, -1);
        const bomb = this._powerUps.bomb;
        this.entityManager.detonateBomb(bomb.enemyDamage, this._boss, bomb.bossDamage);

        this.camera('flash', [250, 255, 255, 255]);
        this.camera('shake', [400, 0.02]);
        this._sfx.bomb();
        navigator.vibrate?.(200);
    }

    private showBanner(text: string) {
        this.hud('banner', [text]);
    }

    /** HUD messages, shown on the guests' screens too */
    private hud(kind: 'banner' | 'hint' | 'dialogue', args: unknown[]) {
        const events = {banner: GameConstants.Events.BANNER_EVENT, hint: GameConstants.Events.HINT_EVENT,
            dialogue: GameConstants.Events.DIALOGUE_EVENT};
        this.game.events.emit(events[kind], ...args);
        this._netHost?.fx('hud', kind, args);
    }

    /** Camera flash or shake, for everyone */
    private camera(method: 'flash' | 'shake', args: number[]) {
        if (method === 'flash')
            this.cameras.main.flash(args[0], args[1], args[2], args[3]);
        else
            this.cameras.main.shake(args[0], args[1]);
        this._netHost?.fx('camera', method, args);
    }

    /**
     * Every effect and sound played here is replayed by the guests.
     */
    private recordForGuests() {
        const host = this._netHost!;
        host.record('effects', this._effects, ['explosion', 'absorb', 'ring', 'floatingText']);
        host.record('sfx', this._sfx, ['explosion', 'coin', 'powerUp', 'bomb', 'alarm', 'absorb', 'polaritySwitch', 'burst',
            'clap', 'boo', 'revive']);
        // The sound manager is shared by every scene: put it back when the game ends
        const play = this.sound.play;
        host.record('sound', this.sound, ['play']);
        this.events.once(Scenes.Events.SHUTDOWN, () => this.sound.play = play);
        host.onBomb = () => this.useBomb();
    }

    private pauseGame() {
        if (!this.scene.isActive())
            return;

        this.scene.pause();
        this.scene.launch(GameConstants.SceneKeys.PAUSE, {gameKey: GameConstants.SceneKeys.MAIN_GAME});
    }

    private endRun(victory: boolean, delayMs: number) {
        if (this._ended)
            return;
        this._ended = true;

        // Results are read after the delay, so coins picked up meanwhile still count
        this.time.delayedCall(delayMs, () => this.finishRun(victory));
    }

    private finishRun(victory: boolean) {
        const bestScore: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const currentScore: number = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        const newBestScore = currentScore > bestScore;
        if (newBestScore)
            this.saveManager.setData(SaveConstants.Keys.PLAYER_BEST_SCORE, currentScore);

        // Credits are kept even on a lost run, so every attempt makes the ship stronger
        const credits = Number(this.registry.get(RegistryConstants.Keys.RUN_CREDITS) ?? 0);
        Progress.addCredits(this.saveManager, credits);
        const kills = Number(this.registry.get(RegistryConstants.Keys.KILLS) ?? 0);
        if (this._endless) {
            this.finishEndlessStage(victory, currentScore, kills, credits, newBestScore);
            return;
        }
        if (victory)
            Progress.unlockLevel(this.saveManager, this._levelIndex + 1);

        const result: RunResultData = {
            level: this._levelIndex,
            victory,
            score: currentScore,
            kills,
            credits,
            newBestScore
        };
        if (this._netHost)
            Net.sendToGuests({k: 'end', result});
        this.scene.start(GameConstants.SceneKeys.GAME_OVER, result);
    }

    /**
     * Endless mode: a cleared stage opens the shop, which then starts the next one;
     * a lost run sends its score to the leaderboard (GameOverScene shows the rank).
     */
    private finishEndlessStage(victory: boolean, score: number, kills: number, credits: number, newBestScore: boolean) {
        const stage = this._endless!.stage;
        if (victory) {
            this.scene.stop(GameConstants.SceneKeys.MAIN_UI);
            this.scene.start(GameConstants.SceneKeys.SHOP, {endless: {stage: stage + 1, score, kills}});
            return;
        }

        const name = PlayerName.get(this.saveManager);
        const result: GameOverData = {
            level: -1, victory, score, kills, credits, newBestScore, stage,
            submitted: name && score > 0 ? Leaderboard.submit({name, score, stage}) : Promise.resolve(null),
        };
        this.scene.start(GameConstants.SceneKeys.GAME_OVER, result);
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        this._backdrop.update(deltaTime);

        this._waveManager.update();
        this._scoreManager.update(this.time.now);
        this._coop?.update(deltaTime);
        this._labels.forEach((label, ship) => label.setPosition(ship.x, ship.y + 70)
            .setText(ship.isGhost ? `P${ship.index + 1} FANTOME` : `P${ship.index + 1}`)
            .setColor(ship.isGhost ? '#b9c7ff' : POLARITY_STYLES[ship.polarity].lightCss)
            .setVisible(ship.active));
        this._netHost?.update(deltaTime);
    }
}
