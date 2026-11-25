import {Scene} from "phaser";
import type {PickupType} from "../gameData/PowerUpData.ts";

type PickupStyle = { color: string, symbol: string };

/**
 * Draws the textures the atlas does not have (pickups, particles, shield) once, on canvases.
 */
export default class TextureFactory {
    public static readonly PARTICLE_KEY: string = 'particle';
    public static readonly SHIELD_KEY: string = 'shield';

    private static readonly PICKUP_RADIUS: number = 30;
    private static readonly PICKUP_STYLES: { [type in PickupType]: PickupStyle } = {
        credit: {color: '#ffd166', symbol: '$'},
        rapidFire: {color: '#ff8c42', symbol: 'R'},
        multiShot: {color: '#4cc9f0', symbol: 'M'},
        shield: {color: '#7bd389', symbol: 'S'},
        heal: {color: '#ff4d6d', symbol: '+'},
        bomb: {color: '#c77dff', symbol: 'B'},
    };

    public static pickupKey(type: PickupType): string {
        return `pickup-${type}`;
    }

    public static generate(scene: Scene) {
        for (const [type, style] of Object.entries(TextureFactory.PICKUP_STYLES))
            TextureFactory.createPickup(scene, TextureFactory.pickupKey(type as PickupType), style);

        TextureFactory.createCanvas(scene, TextureFactory.PARTICLE_KEY, 16, (context) => {
            context.fillStyle = '#ffffff';
            context.beginPath();
            context.arc(8, 8, 7, 0, Math.PI * 2);
            context.fill();
        });

        TextureFactory.createCanvas(scene, TextureFactory.SHIELD_KEY, 160, (context) => {
            context.strokeStyle = '#7bd389';
            context.lineWidth = 8;
            context.globalAlpha = 0.8;
            context.beginPath();
            context.arc(80, 80, 72, 0, Math.PI * 2);
            context.stroke();
            context.globalAlpha = 0.15;
            context.fillStyle = '#7bd389';
            context.fill();
        });
    }

    private static createPickup(scene: Scene, key: string, style: PickupStyle) {
        const radius = TextureFactory.PICKUP_RADIUS;
        TextureFactory.createCanvas(scene, key, radius * 2 + 8, (context) => {
            const center = radius + 4;
            context.fillStyle = style.color;
            context.strokeStyle = '#ffffff';
            context.lineWidth = 5;
            context.beginPath();
            context.arc(center, center, radius, 0, Math.PI * 2);
            context.fill();
            context.stroke();

            context.fillStyle = '#1b1430';
            context.font = `bold ${radius * 1.3}px sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(style.symbol, center, center + 2);
        });
    }

    private static createCanvas(scene: Scene, key: string, size: number,
                                draw: (context: CanvasRenderingContext2D) => void) {
        if (scene.textures.exists(key))
            return;

        const texture = scene.textures.createCanvas(key, size, size);
        if (!texture)
            return;

        draw(texture.getContext());
        texture.refresh();
    }
}
