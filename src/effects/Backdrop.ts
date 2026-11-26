import {GameObjects, Scene} from "phaser";
import TextureFactory from "../utils/TextureFactory.ts";

/**
 * Deep space behind every screen: a nebula and two star layers scrolling down at different speeds (parallax).
 */
export default class Backdrop {
    /** Screen px per ms */
    private static readonly NEBULA_SPEED: number = 0.03;
    private static readonly FAR_SPEED: number = 0.08;
    private static readonly NEAR_SPEED: number = 0.25;

    private readonly _nebula: GameObjects.TileSprite;
    private readonly _far: GameObjects.TileSprite;
    private readonly _near: GameObjects.TileSprite;

    /**
     * @param speedFactor slower on menus than in game
     */
    constructor(scene: Scene, private readonly speedFactor: number = 1) {
        const {width, height} = scene.scale;
        this._nebula = scene.add.tileSprite(0, 0, width, height, TextureFactory.NEBULA_KEY)
            .setOrigin(0).setTileScale(4);
        this._far = scene.add.tileSprite(0, 0, width, height, TextureFactory.STARS_FAR_KEY)
            .setOrigin(0).setTileScale(3);
        this._near = scene.add.tileSprite(0, 0, width, height, TextureFactory.STARS_NEAR_KEY)
            .setOrigin(0).setTileScale(3);

        // Menu scenes have no update loop of their own to call
        if (speedFactor !== 1) {
            const onUpdate = (_time: number, delta: number) => this.update(delta);
            scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
            // Scene events outlive a scene restart
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
        }
    }

    public update(deltaTime: number) {
        const delta = deltaTime * this.speedFactor;
        // tilePosition is in texture pixels: divide by the scale so the speeds are in screen pixels
        this._nebula.tilePositionY -= Backdrop.NEBULA_SPEED * delta / this._nebula.tileScaleY;
        this._far.tilePositionY -= Backdrop.FAR_SPEED * delta / this._far.tileScaleY;
        this._near.tilePositionY -= Backdrop.NEAR_SPEED * delta / this._near.tileScaleY;
    }
}
