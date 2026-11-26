import {GameObjects, Scene} from "phaser";
import TextureFactory from "../utils/TextureFactory.ts";

/**
 * Deep space behind every screen: a nebula and two star layers scrolling down at different speeds (parallax).
 *
 * Only the nebula of the menus covers the whole screen. The stars are small separate sprites: full screen star layers
 * were mostly transparent pixels, drawn anyway every frame, and cost phones a lot of their frame rate.
 */
export default class Backdrop {
    /** Name of the star sprites: coop guests draw their own sky, the host does not send them */
    public static readonly STAR_NAME: string = 'backdropStar';

    /** Screen px per ms */
    private static readonly NEBULA_SPEED: number = 0.03;
    private static readonly FAR_SPEED: number = 0.08;
    private static readonly NEAR_SPEED: number = 0.25;
    /** Stars per million screen px² */
    private static readonly FAR_DENSITY: number = 68;
    private static readonly NEAR_DENSITY: number = 12;
    /** Share of the near stars drawn bright, with a cross */
    private static readonly BRIGHT_SHARE: number = 0.4;
    private static readonly IN_GAME_FAR_ALPHA: number = 0.45;
    private static readonly IN_GAME_NEAR_ALPHA: number = 0.6;
    /** Room above the screen where a star waits before coming back in */
    private static readonly WRAP_MARGIN: number = 20;

    /** Menus only: in game the plain background color stands in for it, a full screen layer is too costly */
    private readonly _nebula: GameObjects.TileSprite | null = null;
    private readonly _far: GameObjects.Image[] = [];
    private readonly _near: GameObjects.Image[] = [];
    private readonly _width: number;
    private readonly _height: number;

    /**
     * @param speedFactor slower on menus than in game
     */
    constructor(scene: Scene, private readonly speedFactor: number = 1) {
        const {width, height} = scene.scale;
        this._width = width;
        this._height = height;
        // In game the stars are dimmed so the enemy bullets stand out
        const inGame = speedFactor === 1;
        if (!inGame)
            this._nebula = scene.add.tileSprite(0, 0, width, height, TextureFactory.NEBULA_KEY)
                .setOrigin(0).setTileScale(4);
        const area = width * height / 1e6;
        for (let i = 0; i < Math.round(Backdrop.FAR_DENSITY * area); i++) {
            const key = Phaser.Utils.Array.GetRandom(TextureFactory.STAR_FAR_KEYS as string[]);
            this._far.push(this.addStar(scene, key, inGame ? Backdrop.IN_GAME_FAR_ALPHA : 1));
        }
        for (let i = 0; i < Math.round(Backdrop.NEAR_DENSITY * area); i++) {
            const key = Math.random() < Backdrop.BRIGHT_SHARE ? TextureFactory.STAR_BRIGHT_KEY : TextureFactory.STAR_NEAR_KEY;
            this._near.push(this.addStar(scene, key, inGame ? Backdrop.IN_GAME_NEAR_ALPHA : 1));
        }

        // Menu scenes have no update loop of their own to call
        if (!inGame) {
            const onUpdate = (_time: number, delta: number) => this.update(delta);
            scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
            // Scene events outlive a scene restart
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
        }
    }

    public update(deltaTime: number) {
        const delta = deltaTime * this.speedFactor;
        // tilePosition is in texture pixels: divide by the scale so the speed is in screen pixels
        if (this._nebula)
            this._nebula.tilePositionY -= Backdrop.NEBULA_SPEED * delta / this._nebula.tileScaleY;
        this.scroll(this._far, Backdrop.FAR_SPEED * delta);
        this.scroll(this._near, Backdrop.NEAR_SPEED * delta);
    }

    private addStar(scene: Scene, key: string, alpha: number): GameObjects.Image {
        return scene.add.image(Math.random() * this._width, Math.random() * this._height, key).setAlpha(alpha).setName(Backdrop.STAR_NAME);
    }

    /** Down the screen; a star leaving at the bottom comes back at the top, somewhere else */
    private scroll(stars: GameObjects.Image[], dy: number) {
        for (const star of stars) {
            star.y += dy;
            if (star.y > this._height + Backdrop.WRAP_MARGIN) {
                star.y -= this._height + 2 * Backdrop.WRAP_MARGIN;
                star.x = Math.random() * this._width;
            }
        }
    }
}
