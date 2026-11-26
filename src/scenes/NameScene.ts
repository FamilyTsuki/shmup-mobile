import {Scene, Scenes} from "phaser";
import GameConstants from "../GameConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import PlayerName from "../managers/PlayerName.ts";
import Button from "../ui/Button.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";
import launchGame from "./launchGame.ts";
import Progress from "../managers/Progress.ts";

export type NameSceneData = {
    /** "endless" starts a run once the nickname is set, "home" goes back to the title */
    next: 'endless' | 'home';
};

/**
 * Asks the nickname shown on the leaderboard. Phaser has no text field: a real HTML input sits over the canvas,
 * so phones open their own keyboard.
 */
export default class NameScene extends Scene {
    private static readonly INPUT_STYLE: Partial<CSSStyleDeclaration> = {
        position: 'fixed', left: '50%', top: '32%', transform: 'translate(-50%, -50%)', width: 'min(80vw, 46vh)',
        padding: '0.5em', fontSize: 'min(6vw, 3.4vh)', fontFamily: `${UiStyle.FONT}, monospace`, textAlign: 'center',
        textTransform: 'uppercase', color: UiStyle.TEXT_CSS, background: '#221b36', border: `4px solid ${UiStyle.CHROME_CSS}`,
        outline: 'none', borderRadius: '0', zIndex: '10',
    };

    private saveManager: SaveManager;
    private _next: NameSceneData['next'];
    private _input: HTMLInputElement;
    private _okButton: Button;

    constructor() {
        super(GameConstants.SceneKeys.NAME);
    }

    // noinspection JSUnusedGlobalSymbols
    create(data: NameSceneData) {
        this._next = data?.next ?? 'home';
        const centerX = this.scale.width / 2;

        new Backdrop(this, 0.5);
        this.add.text(centerX, 260, 'TON PSEUDO', UiStyle.text(100)).setOrigin(0.5);
        this.add.text(centerX, 860, 'Il apparait dans le classement', UiStyle.body(40)).setOrigin(0.5);

        this._okButton = new Button(this, centerX, 1150, this._next === 'endless' ? 'JOUER' : 'VALIDER', () => this.confirm());
        Button.icon(this, centerX, 1360, 'back', () => this.scene.start(GameConstants.SceneKeys.HOME));

        this._input = document.createElement('input');
        Object.assign(this._input.style, NameScene.INPUT_STYLE);
        Object.assign(this._input, {
            type: 'text', maxLength: PlayerName.MAX_LENGTH, placeholder: 'PSEUDO', autocomplete: 'off',
            spellcheck: false, value: PlayerName.get(this.saveManager),
        });
        this._input.addEventListener('input', this.onInput);
        this._input.addEventListener('keydown', this.onKeyDown);
        document.body.appendChild(this._input);
        this.onInput();

        // Phaser keeps its keyboard shortcuts while the field has the focus: give the keys back to the field
        this.input.keyboard?.disableGlobalCapture();
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this._input.remove();
            this.input.keyboard?.enableGlobalCapture();
        });
    }

    private onInput = () => {
        const cleaned = PlayerName.clean(this._input.value);
        if (cleaned !== this._input.value)
            this._input.value = cleaned;
        this._okButton.setEnabled(cleaned.trim().length > 0);
    };

    private onKeyDown = (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.key === 'Enter')
            this.confirm();
    };

    private confirm() {
        const name = PlayerName.clean(this._input.value).trim();
        if (!name)
            return;

        PlayerName.set(this.saveManager, name);
        this._input.blur();
        if (this._next === 'endless')
            launchGame(this, this.saveManager, {endless: Progress.endlessRunToPlay(this.saveManager)});
        else
            this.scene.start(GameConstants.SceneKeys.HOME);
    }
}
