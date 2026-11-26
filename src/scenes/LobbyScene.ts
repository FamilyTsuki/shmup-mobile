import {GameObjects, Scene, Scenes} from "phaser";
import GameConstants from "../GameConstants.ts";
import Net from "../net/Net.ts";
import CoopFlow from "../net/CoopFlow.ts";
import type {GuestMessage, LobbyPlayer} from "../net/Protocol.ts";
import Backdrop from "../effects/Backdrop.ts";
import Button, {ButtonStyle} from "../ui/Button.ts";
import UiStyle from "../ui/UiStyle.ts";
import SaveManager from "../managers/SaveManager.ts";
import Progress from "../managers/Progress.ts";
import Settings from "../managers/Settings.ts";
import GyroSensor from "../input/GyroSensor.ts";
import type {LevelsData} from "../gameData/LevelData.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import {computePlayerStats, UpgradesData} from "../gameData/UpgradeData.ts";
import launchGame from "./launchGame.ts";

export type LobbySceneData = {
    /** Joins this room right away, e.g. from a "?salon=1234" link */
    join?: string;
};

type View = 'menu' | 'code' | 'room';

/**
 * Coop rooms: create one and share its code, or type a code to join one.
 * In the room the host picks the level; guests wait for it to start.
 */
export default class LobbyScene extends Scene {
    private static readonly CODE_LENGTH: number = 4;
    private static readonly KEY: ButtonStyle = {width: 220, height: 150, fontSize: 64, fillColor: UiStyle.PANEL};
    private static readonly LEVEL: ButtonStyle = {width: 160, height: 150, fontSize: 64, fillColor: UiStyle.PANEL};

    private saveManager: SaveManager;
    private _view: View = 'menu';
    private _content: GameObjects.GameObject[] = [];
    private _code: string = '';
    private _status: GameObjects.Text;

    constructor() {
        super(GameConstants.SceneKeys.LOBBY);
    }

    // noinspection JSUnusedGlobalSymbols
    create(data: LobbySceneData) {
        this.saveManager.load();
        const centerX = this.scale.width / 2;
        new Backdrop(this, 0.5);
        this.add.text(centerX, 180, 'COOP', UiStyle.text(130)).setOrigin(0.5);
        this._status = this.add.text(centerX, 1560, CoopFlow.closedMessage, {...UiStyle.body(40, '#f6d55c'), align: 'center'})
            .setOrigin(0.5);
        CoopFlow.closedMessage = '';

        Net.on(Net.ROOM_EVENT, this.onRoom, this);
        Net.on(Net.PLAYERS_EVENT, this.onPlayers, this);
        Net.on(Net.ERROR_EVENT, this.onError, this);
        Net.on(Net.MESSAGE_EVENT, this.onMessage, this);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            Net.off(Net.ROOM_EVENT, this.onRoom, this);
            Net.off(Net.PLAYERS_EVENT, this.onPlayers, this);
            Net.off(Net.ERROR_EVENT, this.onError, this);
            Net.off(Net.MESSAGE_EVENT, this.onMessage, this);
        });

        if (data?.join) {
            this._code = data.join;
            this.joinRoom();
        }
        // Back from the shop: the ship or the upgrades may have changed, and players may have joined meanwhile
        if (Net.role === 'guest')
            this.sendHello();
        else if (Net.role === 'host')
            this.announcePlayers();
        this.show(Net.role ? 'room' : 'menu');
    }

    private show(view: View) {
        this._view = view;
        this._content.forEach(object => object.destroy());
        this._content = [];

        switch (view) {
            case 'menu':
                this.buildMenu();
                break;
            case 'code':
                this.buildKeypad();
                break;
            case 'room':
                this.buildRoom();
                break;
        }
    }

    private track<T extends GameObjects.GameObject>(object: T): T {
        this._content.push(object);
        return object;
    }

    private buildMenu() {
        const centerX = this.scale.width / 2;
        this.track(this.add.text(centerX, 420, "Jouez à 2, 3 ou 4\nsur le même Wi-Fi ou à distance",
            {...UiStyle.body(44, UiStyle.TEXT_CSS), align: 'center', lineSpacing: 16}).setOrigin(0.5));
        this.track(new Button(this, centerX, 700, 'CRÉER UN SALON', () => this.createRoom()));
        this.track(new Button(this, centerX, 900, 'REJOINDRE', () => {
            this._code = '';
            this.show('code');
        }));
        this.track(Button.icon(this, centerX, 1780, 'back', () => this.scene.start(GameConstants.SceneKeys.HOME)));
    }

    /** A phone friendly keypad: room codes are digits only */
    private buildKeypad() {
        const centerX = this.scale.width / 2;
        this.track(this.add.text(centerX, 380, 'CODE DU SALON', UiStyle.text(56)).setOrigin(0.5));
        const display = this.track(this.add.text(centerX, 520, '', UiStyle.text(140, '#f6d55c')).setOrigin(0.5));
        const refresh = () => display.setText(this._code.padEnd(LobbyScene.CODE_LENGTH, '_').split('').join(' '));
        refresh();

        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'];
        keys.forEach((key, index) => {
            const x = centerX + (index % 3 - 1) * 250;
            const y = 760 + Math.floor(index / 3) * 180;
            this.track(new Button(this, x, y, key, () => {
                if (key === '<')
                    this._code = this._code.slice(0, -1);
                else if (key === 'OK')
                    this.joinRoom();
                else if (this._code.length < LobbyScene.CODE_LENGTH)
                    this._code += key;
                refresh();
                if (this._code.length === LobbyScene.CODE_LENGTH && key !== 'OK' && key !== '<')
                    this.joinRoom();
            }, LobbyScene.KEY));
        });
        this.track(Button.icon(this, centerX, 1780, 'back', () => this.show('menu')));
    }

    private buildRoom() {
        const centerX = this.scale.width / 2;
        const host = Net.role === 'host';
        this.track(this.add.text(centerX, 330, 'SALON', UiStyle.text(56, UiStyle.MUTED_CSS)).setOrigin(0.5));
        this.track(this.add.text(centerX, 450, Net.code, UiStyle.text(170, '#f6d55c')).setOrigin(0.5));

        const ships = this.cache.json.get(GameConstants.DataKeys.PLAYER_SHIPS) as PlayerShipsData;
        this.lobbyPlayers().forEach((player, index) => {
            const ship = ships[player.ship]?.name ?? '';
            const you = player.id === Net.myId ? ' (toi)' : '';
            const role = player.id === Net.hostId ? 'HÔTE' : 'INVITÉ';
            this.track(this.add.text(140, 620 + index * 90, `P${index + 1}  ${UiStyle.upper(role)}${you}  ${ship}`,
                UiStyle.body(40, UiStyle.TEXT_CSS)).setOrigin(0, 0.5));
        });

        if (host) {
            this.track(this.add.text(centerX, 1060, 'CHOISIS LE NIVEAU', UiStyle.text(48)).setOrigin(0.5));
            const levels = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels;
            const unlocked = Progress.getUnlockedLevel(this.saveManager);
            levels.forEach((_, index) => {
                const x = centerX + (index - (levels.length - 1) / 2) * 190;
                this.track(new Button(this, x, 1220, String(index + 1), () => launchGame(this, this.saveManager, index),
                    LobbyScene.LEVEL).setEnabled(index <= unlocked));
            });
            this.track(this.add.text(centerX, 1400, Net.players.length < 2
                ? "Donne le code à tes amis :\nCOOP > REJOINDRE"
                : 'Plus on est de fous, plus les ennemis sont costauds',
            {...UiStyle.body(36), align: 'center', lineSpacing: 12}).setOrigin(0.5));
        } else {
            const waiting = this.track(this.add.text(centerX, 1200, "L'hôte choisit le niveau...",
                UiStyle.body(46, UiStyle.TEXT_CSS)).setOrigin(0.5));
            this.tweens.add({targets: waiting, alpha: 0.3, duration: 600, yoyo: true, repeat: -1});
        }

        // Coop has its own credits and upgrades, spent here
        Button.iconRow(this, 1760, [
            ['shop', () => this.scene.start(GameConstants.SceneKeys.SHOP)],
            ['exit', () => {
                Net.leave();
                this.show('menu');
            }],
        ]).forEach(button => this.track(button));
    }

    /** Host: from the room and the guests' hellos. Guest: as announced by the host */
    private lobbyPlayers(): LobbyPlayer[] {
        if (Net.role === 'guest' && Net.lobby.length > 0)
            return Net.lobby;
        return Net.players.map((id, index) => ({
            id, index,
            ship: id === Net.myId ? Progress.getSelectedShip(this.saveManager) : Net.guests.get(id)?.ship ?? 1,
        }));
    }

    private async createRoom() {
        this._status.setText('Connexion...');
        try {
            await Net.create();
        } catch {
            this._status.setText('Serveur coop injoignable');
        }
    }

    private async joinRoom() {
        if (this._code.length !== LobbyScene.CODE_LENGTH)
            return;
        // A tap: the moment iOS accepts to ask for the gyroscope
        if (Settings.getControls(this.saveManager).mode === 'gyro')
            void GyroSensor.requestAccess();
        this._status.setText('Connexion...');
        try {
            await Net.join(this._code);
        } catch {
            this._status.setText('Serveur coop injoignable');
        }
    }

    private onRoom() {
        this._status.setText('');
        if (Net.role === 'guest')
            this.sendHello();
        this.show('room');
    }

    /** Guest: tells the host which ship and upgrades (of the coop progression) this player brings */
    private sendHello() {
        const upgrades = this.cache.json.get(GameConstants.DataKeys.UPGRADES) as UpgradesData;
        const shipId = Progress.getSelectedShip(this.saveManager);
        const ship = (this.cache.json.get(GameConstants.DataKeys.PLAYER_SHIPS) as PlayerShipsData)[shipId];
        const hello: GuestMessage = {k: 'hello', ship: shipId,
            stats: computePlayerStats(upgrades, Progress.getUpgradeLevels(this.saveManager), ship?.bonus)};
        Net.sendToHost(hello);
    }

    private onPlayers() {
        if (Net.role === 'host')
            this.announcePlayers();
        if (this._view === 'room')
            this.show('room');
    }

    private onMessage(_from: number, data: { k: string }) {
        // Host: a guest said hello with its ship; guest: the host sent the list
        if (Net.role === 'host' && data.k === 'hello')
            this.announcePlayers();
        if (this._view === 'room' && (data.k === 'hello' || data.k === 'lobby'))
            this.show('room');
    }

    private announcePlayers() {
        Net.sendToGuests({k: 'lobby', players: this.lobbyPlayers()});
    }

    private onError(reason: string) {
        this._status.setText(reason === 'full' ? 'Ce salon est plein (4 joueurs)' : 'Aucun salon avec ce code');
        this._code = '';
        if (this._view === 'code')
            this.show('code');
    }
}
