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

    public static show(game: Game) {
        if (!Settings.isGyroDevice())
            return;

        const overlay = document.createElement('div');
        overlay.id = 'start-overlay';
        overlay.innerHTML = `
            <div class="start-title"><span class="ion">ION</span> // <span class="plasma">PLASMA</span></div>
            <div class="start-tap">TOUCHE POUR JOUER</div>
            <div class="start-hint">Le jeu se pilote en penchant le téléphone :<br>autorise l'accès aux mouvements</div>`;
        document.body.appendChild(overlay);

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
                overlay.remove();
                return;
            }

            const granted = await GyroSensor.requestAccess();
            if (granted) {
                overlay.remove();
                return;
            }
            overlay.querySelector('.start-tap')!.textContent = 'CONTRÔLE AU DOIGT';
            overlay.querySelector('.start-hint')!.innerHTML = window.isSecureContext
                ? 'Gyroscope refusé.<br>Tu peux le réactiver dans les options.'
                : 'Gyroscope indisponible :<br>la page doit être en HTTPS.';
            window.setTimeout(() => overlay.remove(), StartOverlay.RESULT_MS);
        });
    }
}
