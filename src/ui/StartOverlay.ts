import type {Game} from "phaser";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";

/**
 * "Tap to play" screen shown over the game when a phone opens the page.
 * Its tap is the user gesture iOS requires before showing the gyroscope permission prompt,
 * so the game is steered by tilting from the start. It also unlocks the sound.
 * Plain HTML on top of the canvas, so it also shows when the page opens straight on another screen (room link).
 */
export default class StartOverlay {
    private static readonly RESULT_MS: number = 1600;
    /** The game ignores touches a moment longer, so the tap that closes the overlay never presses a menu button */
    private static readonly INPUT_GUARD_MS: number = 400;
    private static readonly SWALLOWED_EVENTS: readonly string[] = ['pointerdown', 'pointerup', 'mousedown', 'mouseup',
        'touchstart', 'touchend', 'click'];

    public static show(game: Game) {
        if (!Settings.isGyroDevice())
            return;

        const overlay = document.createElement('div');
        overlay.id = 'start-overlay';
        overlay.innerHTML = `
            <div class="start-title"><span class="ion">FLIP</span><span class="plasma">CHARGE</span></div>
            <div class="start-tap">TOUCHE POUR COMMENCER</div>
            <div class="start-hint">Le jeu se pilote en penchant le téléphone :<br>autorise l'accès aux mouvements</div>`;
        document.body.appendChild(overlay);

        // Phaser also listens on the window: keep the overlay's touches from reaching the menu under it
        game.input.enabled = false;
        for (const type of StartOverlay.SWALLOWED_EVENTS)
            overlay.addEventListener(type, event => event.stopPropagation());
        const close = () => {
            overlay.remove();
            window.setTimeout(() => game.input.enabled = true, StartOverlay.INPUT_GUARD_MS);
        };

        overlay.addEventListener('click', async () => {
            if (overlay.dataset.busy)
                return;
            overlay.dataset.busy = '1';

            // Unlock the sound with the same tap
            const sound = game.sound as Phaser.Sound.WebAudioSoundManager;
            void sound.context?.resume();

            const saveManager = game.plugins.get(SaveManager.PLUGIN_KEY) as SaveManager;
            saveManager.load();
            const wantsGyro = !Settings.isControlModeChosen(saveManager) || Settings.getControls(saveManager).mode === 'gyro';
            if (!wantsGyro) {
                close();
                return;
            }

            const granted = await GyroSensor.requestAccess();
            if (granted) {
                close();
                return;
            }
            overlay.querySelector('.start-tap')!.textContent = 'CONTRÔLE AU DOIGT';
            overlay.querySelector('.start-hint')!.innerHTML = window.isSecureContext
                ? 'Gyroscope refusé.<br>Tu peux le réactiver dans les options.'
                : 'Gyroscope indisponible :<br>la page doit être en HTTPS.';
            window.setTimeout(close, StartOverlay.RESULT_MS);
        });
    }
}
