import {Scene} from "phaser";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import RegistryConstants from "../RegistryConstants.ts";

/**
 * Score with a combo multiplier: chaining kills raises it, getting hit or waiting too long resets it.
 * Publishes score, combo, kills and run credits in the registry for the HUD.
 */
export default class ScoreManager {
    private static readonly COMBO_WINDOW_MS: number = 2500;
    private static readonly KILLS_PER_MULTIPLIER: number = 5;
    private static readonly MAX_MULTIPLIER: number = 5;

    private readonly _scene: Scene;
    private _streak: number = 0;
    private _lastKillTime: number = 0;

    constructor(scene: Scene) {
        this._scene = scene;

        const registry = scene.registry;
        registry.set(RegistryConstants.Keys.PLAYER_SCORE, 0);
        registry.set(RegistryConstants.Keys.COMBO, 1);
        registry.set(RegistryConstants.Keys.KILLS, 0);
        registry.set(RegistryConstants.Keys.RUN_CREDITS, 0);

        scene.events.on(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
        scene.events.on(Player.HIT_EVENT, this.resetCombo, this);
    }

    public get multiplier(): number {
        return Math.min(1 + Math.floor(this._streak / ScoreManager.KILLS_PER_MULTIPLIER), ScoreManager.MAX_MULTIPLIER);
    }

    /** Points are multiplied by the current combo */
    public addScore(points: number) {
        this._scene.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, points * this.multiplier);
    }

    /** Absorbing bullets keeps the combo going between kills */
    public keepComboAlive() {
        if (this._streak > 0)
            this._lastKillTime = this._scene.time.now;
    }

    public addCredits(credits: number) {
        this._scene.registry.inc(RegistryConstants.Keys.RUN_CREDITS, credits);
    }

    public update(time: number) {
        if (this._streak > 0 && time - this._lastKillTime > ScoreManager.COMBO_WINDOW_MS)
            this.resetCombo();
    }

    public destroy() {
        this._scene.events.off(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
        this._scene.events.off(Player.HIT_EVENT, this.resetCombo, this);
    }

    private onEnemyKilled(enemy: Enemy) {
        this._streak++;
        this._lastKillTime = this._scene.time.now;
        this._scene.registry.inc(RegistryConstants.Keys.KILLS);
        this._scene.registry.set(RegistryConstants.Keys.COMBO, this.multiplier);

        this.addScore(enemy.enemyData.score);
    }

    private resetCombo() {
        this._streak = 0;
        this._scene.registry.set(RegistryConstants.Keys.COMBO, 1);
    }
}
