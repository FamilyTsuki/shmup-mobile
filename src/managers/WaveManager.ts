import {Events, Scene} from "phaser";
import EntityManager from "./EntityManager.ts";
import type {LevelData, SpawnGroupData} from "../gameData/LevelData.ts";

/**
 * Plays the waves of a level one after the other: the next wave starts once every enemy of the
 * current one is spawned and gone (killed or off screen).
 */
export default class WaveManager extends Events.EventEmitter {
    /** (waveIndex: number, waveCount: number) */
    public static readonly WAVE_STARTED_EVENT: string = 'waveStarted';
    public static readonly ALL_WAVES_CLEARED_EVENT: string = 'allWavesCleared';

    private static readonly BREAK_BETWEEN_WAVES_MS: number = 1800;
    private static readonly SCREEN_MARGIN: number = 120;
    private static readonly V_SPACING_X: number = 130;
    private static readonly V_SPACING_Y: number = 110;

    private readonly _scene: Scene;
    private readonly _entityManager: EntityManager;
    private readonly _level: LevelData;
    private _waveIndex: number = -1;
    private _pendingSpawns: number = 0;
    private _waveRunning: boolean = false;

    constructor(scene: Scene, entityManager: EntityManager, level: LevelData) {
        super();

        this._scene = scene;
        this._entityManager = entityManager;
        this._level = level;
    }

    public start() {
        this.startWave(0);
    }

    public update() {
        if (!this._waveRunning || this._pendingSpawns > 0 || this._entityManager.activeEnemyCount() > 0)
            return;

        this._waveRunning = false;
        if (this._waveIndex >= this._level.waves.length - 1) {
            this.emit(WaveManager.ALL_WAVES_CLEARED_EVENT);
            return;
        }

        this._scene.time.delayedCall(WaveManager.BREAK_BETWEEN_WAVES_MS, () => this.startWave(this._waveIndex + 1));
    }

    private startWave(index: number) {
        this._waveIndex = index;
        this._waveRunning = true;

        const wave = this._level.waves[index];
        this._pendingSpawns = wave.groups.reduce((total, group) => total + group.count, 0);
        wave.groups.forEach(group => this._scene.time.delayedCall(group.delayMs ?? 0, () => this.spawnGroup(group)));

        this.emit(WaveManager.WAVE_STARTED_EVENT, index, this._level.waves.length);
    }

    private spawnGroup(group: SpawnGroupData) {
        const width = this._scene.cameras.main.width;
        const margin = WaveManager.SCREEN_MARGIN;

        switch (group.formation) {
            case 'line':
                for (let i = 0; i < group.count; i++) {
                    const x = group.count === 1 ? width / 2 : margin + i * (width - margin * 2) / (group.count - 1);
                    this.spawn(group.enemy, x, 0);
                }
                break;
            case 'v': {
                const middle = (group.count - 1) / 2;
                for (let i = 0; i < group.count; i++) {
                    const x = width / 2 + (i - middle) * WaveManager.V_SPACING_X;
                    this.spawn(group.enemy, x, Math.abs(i - middle) * WaveManager.V_SPACING_Y);
                }
                break;
            }
            case 'column': {
                const x = Phaser.Math.Between(margin, width - margin);
                this.spawnOverTime(group, () => x);
                break;
            }
            case 'sides':
                this.spawnOverTime(group, (i) => i % 2 === 0 ? margin : width - margin);
                break;
            case 'random':
                this.spawnOverTime(group, () => Phaser.Math.Between(margin, width - margin));
                break;
        }
    }

    private spawnOverTime(group: SpawnGroupData, getX: (index: number) => number) {
        let index = 0;
        this._scene.time.addEvent({
            delay: Math.max(group.intervalMs, 1),
            repeat: group.count - 1,
            // The first enemy appears right away, the next ones every intervalMs
            startAt: Math.max(group.intervalMs, 1),
            callback: () => this.spawn(group.enemy, getX(index++), 0)
        });
    }

    private spawn(enemyType: string, x: number, heightAboveScreen: number) {
        this._pendingSpawns--;
        this._entityManager.spawnEnemy(enemyType, x, -heightAboveScreen, this._level.difficulty);
    }
}
