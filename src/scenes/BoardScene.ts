import {GameObjects, Scene} from "phaser";
import qrcode from "qrcode-generator";
import GameConstants from "../GameConstants.ts";
import Button from "../ui/Button.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";
import Leaderboard, {ScoreEntry} from "../net/Leaderboard.ts";

/**
 * Screen for the projector: a QR code that opens the game on a phone, straight to the nickname then the endless
 * mode, next to the live leaderboard.
 */
export default class BoardScene extends Scene {
    /** Opens the nickname screen, see HomeScene */
    public static readonly JAM_PARAM: string = 'jam';

    private static readonly QR_TEXTURE: string = 'jamQr';
    private static readonly QR_SIZE: number = 520;
    /** Blank modules around the code, required by the readers */
    private static readonly QR_QUIET_ZONE: number = 2;
    private static readonly ROW_COUNT: number = 10;
    private static readonly FIRST_ROW_Y: number = 1020;
    private static readonly ROW_HEIGHT: number = 68;
    private static readonly REFRESH_MS: number = 5000;
    private static readonly PODIUM_COLORS: string[] = ['#ffd166', '#e3e3f0', '#e0a36a'];

    private _rows: GameObjects.Text[] = [];
    private _status: GameObjects.Text;

    constructor() {
        super(GameConstants.SceneKeys.BOARD);
    }

    /** Link of the QR code: this page, with the jam parameter */
    public static joinUrl(): string {
        return `${location.origin}${location.pathname}?${BoardScene.JAM_PARAM}`;
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const centerX = this.scale.width / 2;
        new Backdrop(this, 0.5);
        this.add.text(centerX, 110, 'CLASSEMENT', UiStyle.text(100)).setOrigin(0.5);

        this.createQrTexture();
        this.add.image(centerX, 460, BoardScene.QR_TEXTURE).setDisplaySize(BoardScene.QR_SIZE, BoardScene.QR_SIZE);
        this.add.text(centerX, 780, 'SCANNE ET JOUE !', UiStyle.text(56, '#ffd166', '#ffb347')).setOrigin(0.5);
        this.add.text(centerX, 860, location.host, UiStyle.body(36, '#ffffff')).setOrigin(0.5);

        this._rows = [];
        for (let i = 0; i < BoardScene.ROW_COUNT; i++) {
            const color = BoardScene.PODIUM_COLORS[i] ?? UiStyle.TEXT_CSS;
            this._rows.push(this.add.text(80, BoardScene.FIRST_ROW_Y + i * BoardScene.ROW_HEIGHT, '',
                UiStyle.text(44, color)).setOrigin(0, 0.5));
        }
        this._status = this.add.text(centerX, BoardScene.FIRST_ROW_Y + 2 * BoardScene.ROW_HEIGHT, 'Chargement...',
            UiStyle.body(40)).setOrigin(0.5);

        new Button(this, centerX, 1800, 'RETOUR', () => this.scene.start(GameConstants.SceneKeys.HOME));

        this.refresh();
        this.time.addEvent({delay: BoardScene.REFRESH_MS, loop: true, callback: this.refresh, callbackScope: this});
    }

    private async refresh() {
        const entries = await Leaderboard.top(BoardScene.ROW_COUNT);
        // The player may have left the screen while the request was running
        if (!this.scene.isActive())
            return;

        if (!entries) {
            this._status.setText('Classement indisponible').setVisible(true);
            return;
        }
        this._status.setText('Personne encore. A toi !').setVisible(entries.length === 0);
        this._rows.forEach((row, index) => row.setText(entries[index] ? BoardScene.formatRow(index, entries[index]) : ''));
    }

    /** " 1. PSEUDO       12345  E4", fixed width columns with the monospace pixel font */
    public static formatRow(index: number, entry: ScoreEntry): string {
        return `${String(index + 1).padStart(2)}. ${entry.name.padEnd(12)} ${String(entry.score).padStart(7)} E${entry.stage}`;
    }

    private createQrTexture() {
        if (this.textures.exists(BoardScene.QR_TEXTURE))
            this.textures.remove(BoardScene.QR_TEXTURE);

        const qr = qrcode(0, 'M');
        qr.addData(BoardScene.joinUrl());
        qr.make();

        // One pixel per module, scaled up without blur (pixelArt)
        const modules = qr.getModuleCount();
        const quiet = BoardScene.QR_QUIET_ZONE;
        const size = modules + quiet * 2;
        const texture = this.textures.createCanvas(BoardScene.QR_TEXTURE, size, size)!;
        const context = texture.getContext();
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size, size);
        context.fillStyle = '#000000';
        for (let row = 0; row < modules; row++) {
            for (let col = 0; col < modules; col++) {
                if (qr.isDark(row, col))
                    context.fillRect(col + quiet, row + quiet, 1, 1);
            }
        }
        texture.refresh();
    }
}
