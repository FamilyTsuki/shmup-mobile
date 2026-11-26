import {Scene} from "phaser";
import type {PickupType} from "../gameData/PowerUpData.ts";
import {POLARITIES, Polarity} from "../gameData/PolarityData.ts";

export type BulletShape = 'orb' | 'needle' | 'bolt';

/** Stored on every generated texture that a physics body uses, in texture pixels */
export type TextureBodyData = {
    hitRadius: number;
    /** Size the gameplay data refers to: orb diameter, needle or bolt thickness */
    coreSize?: number;
};

/**
 * How a sprite drawn as seen on screen is stored in its texture.
 * cw: art drawn nose up, for entities facing up (the texture faces right, the forward direction of entities)
 * ccw: art drawn upright, for bosses displayed rotated by 90 degrees to face down
 */
type Rotation = 'none' | 'cw' | 'ccw';

/** A grid of palette keys, one string per row, "." is transparent */
type PixelGrid = string[];
type Palette = { [key: string]: string };

type SpriteDef = {
    grid: PixelGrid;
    /** Screen pixels per art pixel */
    cell: number;
    /** Hitbox radius in art pixels */
    hitRadius: number;
};

type BossDef = {
    size: number;
    cell: number;
    draw: (context: CanvasRenderingContext2D, colors: ShadeSet) => void;
};

/** Three shades of one polarity, dark to light */
type ShadeSet = { dark: string, mid: string, light: string };

type PickupStyle = { color: string, symbol: string };

/**
 * Draws every texture of the game once, in one retro pixel art style: a soft limited palette,
 * dark outlines and flat shading. Small sprites are hand drawn grids; bosses are drawn at low resolution
 * with canvas shapes, then cleaned (no anti-aliasing) and outlined automatically.
 */
export default class TextureFactory {
    public static readonly PARTICLE_KEY: string = 'particle';
    public static readonly SPARK_KEY: string = 'spark';
    public static readonly RING_KEY: string = 'ring';
    public static readonly SHIELD_KEY: string = 'shield';
    public static readonly LIFE_KEY: string = 'life';
    public static readonly NEBULA_KEY: string = 'nebula';
    public static readonly STARS_FAR_KEY: string = 'starsFar';
    public static readonly STARS_NEAR_KEY: string = 'starsNear';

    /** Radius of the ring texture in texture pixels, so effects can scale it to a radius */
    public static readonly RING_RADIUS: number = 104;

    public static readonly OUTLINE: string = '#1a1426';
    private static readonly SPACE: string = '#0f0c1d';

    /** Colors that do not depend on the polarity */
    private static readonly NEUTRAL: Palette = {
        o: TextureFactory.OUTLINE,
        w: '#f4f1e8',
        g: '#9a93ab',
        G: '#5d566e',
        n: '#2b2540',
        e: '#f2a65a',
        y: '#f6d55c',
        D: '#b8862b',
        r: '#d9534f',
        R: '#8c2f39',
    };

    /** Softer than neon: easy on the eyes on a dark background */
    private static readonly SHADES: { [polarity in Polarity]: ShadeSet } = {
        ion: {dark: '#1f5a70', mid: '#46a9c6', light: '#9be0ec'},
        plasma: {dark: '#6e2547', mid: '#d0577f', light: '#f3a9c1'},
    };

    private static readonly SPRITES: { [shape: string]: SpriteDef } = {
        // Player ships, drawn nose up
        arrow: {
            cell: 5, hitRadius: 2.8, grid: [
                '.......o.......',
                '......olo......',
                '......olo......',
                '.....olmlo.....',
                '.....omnmo.....',
                '....omnwnmo....',
                '....omnnnmo....',
                '...ommmmmmmo...',
                '..omdmmmmmdmo..',
                '.omddmmmmmddmo.',
                'omdddmdmdmdddmo',
                'oddo.omdmo.oddo',
                'ooo..oddo...ooo',
                '.....oeeo......',
                '......ee.......',
            ]
        },
        interceptor: {
            cell: 5, hitRadius: 2.8, grid: [
                '.......o.......',
                '......olo......',
                '......omo......',
                '..o...omo...o..',
                '..lo.omnmo.ol..',
                '..mo.mnwnm.om..',
                '..mmomnnnmomm..',
                '.ommmmmmmmmmmo.',
                'omdmmmmmmmmmdmo',
                'oddmmdmmmdmmddo',
                'odd.oddmddo.ddo',
                'oo..oddoddo..oo',
                '.....oe.eo.....',
                '.....e...e.....',
                '...............',
            ]
        },
        bolt: {
            cell: 5, hitRadius: 2.8, grid: [
                '.......o.......',
                '.......l.......',
                '......olo......',
                '......omo......',
                '......mnm......',
                '.....omwmo.....',
                '.....mnnnm.....',
                '....ommmmmo....',
                '...omdmmmdmo...',
                '..omd.mmm.dmo..',
                '.omd..mdm..dmo.',
                'omd...odo...dmo',
                'oo....oeo....oo',
                '......eye......',
                '.......e.......',
            ]
        },
        // Enemies, drawn nose up too: they are displayed turned toward the player
        delta: {
            cell: 6, hitRadius: 5, grid: [
                '......o......',
                '.....omo.....',
                '....omlmo....',
                'o..omlwlmo..o',
                'mo.omnnnmo.om',
                'mmommnynmmomm',
                'mdmmmnnnmmmdm',
                'odmmmmmmmmmdo',
                '.odmdmmmdmdo.',
                '..od.odo.do..',
                '...o.odo.o...',
                '.....oeo.....',
                '......e......',
            ]
        },
        weaver: {
            cell: 6, hitRadius: 5, grid: [
                '....o...o....',
                '...olo.olo...',
                'o..omooomo..o',
                'lo.ommmmmo.ol',
                'mlo.mnynm.olm',
                'mmlommnmmolmm',
                'dmmmmmmmmmmmd',
                'odmmdmmmdmmdo',
                '.odd.mmm.ddo.',
                '..oo.odo.oo..',
                '.....odo.....',
                '......o......',
                '.............',
            ]
        },
        spike: {
            cell: 6, hitRadius: 4.5, grid: [
                '.....o.....',
                '.....l.....',
                '....olo....',
                '....olo....',
                '...omlmo...',
                '...mnynm...',
                '..omnnnmo..',
                '..mmmmmmm..',
                '.omdmmmdmo.',
                'omd.mdm.dmo',
                'od..odo..do',
                'o...oeo...o',
                '.....e.....',
            ]
        },
        hex: {
            cell: 6, hitRadius: 6.5, grid: [
                '.....ogggo.....',
                '....oogggoo....',
                '...ommgggmmo...',
                '..omdddddddmo..',
                '.omdmmmmmmmdmo.',
                'omlmdddddddmlmo',
                'omlmdnnnnndmlmo',
                'omlmdnyyyndmlmo',
                'omlmdnyyyndmlmo',
                'omlmdnnnnndmlmo',
                'omlmdddddddmlmo',
                '.omlmmmmmmmlmo.',
                '..omlllllllmo..',
                '...ommmmmmmo...',
                '....ooooooo....',
            ]
        },
        turret: {
            cell: 6, hitRadius: 5.5, grid: [
                '.....ogo.....',
                '.....ogo.....',
                '.....ogo.....',
                '...ooogooo...',
                '..ommmgmmmo..',
                '.omllmmmllmo.',
                '.omlmnnnmlmo.',
                'omlmnnynnmlmo',
                'ommmnyyynmmmo',
                'omdmnnynnmdmo',
                '.omdmnnnmdmo.',
                '..omddddmmo..',
                '...ooooooo...',
            ]
        },
    };

    private static readonly BOSSES: { [shape: string]: BossDef } = {
        mothership: {size: 48, cell: 5, draw: (c, s) => TextureFactory.drawSaucer(c, s)},
        dreadnought: {size: 48, cell: 5, draw: (c, s) => TextureFactory.drawDreadnought(c, s)},
        overlord: {size: 52, cell: 5, draw: (c, s) => TextureFactory.drawOverlord(c, s)},
        orchid: {size: 52, cell: 5, draw: (c, s) => TextureFactory.drawOrchid(c, s)},
        blade: {size: 48, cell: 5, draw: (c, s) => TextureFactory.drawBlade(c, s)},
    };

    private static readonly PICKUP_STYLES: { [type in PickupType]: PickupStyle } = {
        credit: {color: '#f6d55c', symbol: ''},
        rapidFire: {color: '#e9894a', symbol: 'R'},
        multiShot: {color: '#8c6bc8', symbol: 'M'},
        shield: {color: '#5fae6e', symbol: 'S'},
        heal: {color: '#d9534f', symbol: '+'},
        bomb: {color: '#5d566e', symbol: 'B'},
    };

    public static shipKey(shape: string, polarity: Polarity): string {
        return `ship-${shape}-${polarity}`;
    }

    public static bulletKey(shape: BulletShape, polarity: Polarity): string {
        return `bullet-${shape}-${polarity}`;
    }

    public static pickupKey(type: PickupType): string {
        return `pickup-${type}`;
    }

    /** Body size stored on a generated texture, see TextureBodyData */
    public static bodyData(scene: Scene, key: string): TextureBodyData {
        return scene.textures.get(key).customData as TextureBodyData;
    }

    public static generate(scene: Scene) {
        for (const polarity of POLARITIES) {
            const palette = TextureFactory.palette(polarity);
            for (const [shape, sprite] of Object.entries(TextureFactory.SPRITES)) {
                TextureFactory.createGrid(scene, TextureFactory.shipKey(shape, polarity), sprite.grid, palette,
                    sprite.cell, 'cw', {hitRadius: sprite.hitRadius * sprite.cell});
            }
            for (const [shape, boss] of Object.entries(TextureFactory.BOSSES))
                TextureFactory.createBoss(scene, TextureFactory.shipKey(shape, polarity), boss, polarity);

            TextureFactory.createBullets(scene, polarity, palette);
        }

        for (const [type, style] of Object.entries(TextureFactory.PICKUP_STYLES))
            TextureFactory.createPickup(scene, type as PickupType, style);

        TextureFactory.createEffects(scene);
        TextureFactory.createBackdrop(scene);
    }

    private static palette(polarity: Polarity): Palette {
        const shades = TextureFactory.SHADES[polarity];
        return {...TextureFactory.NEUTRAL, d: shades.dark, m: shades.mid, l: shades.light};
    }

    // ------------------------------------------------------------------ bullets

    /**
     * ION bullets are hollow rings, PLASMA bullets are filled with a white core:
     * the shape tells the polarity apart even without colors.
     */
    private static createBullets(scene: Scene, polarity: Polarity, palette: Palette) {
        const ion = polarity === 'ion';
        const orb = ion
            ? ['..mmm..', '.mlllm.', 'mll.llm', 'ml...lm', 'mll.llm', '.mlllm.', '..mmm..']
            : ['..mmm..', '.mlllm.', 'mllwllm', 'mlwwwlm', 'mllwllm', '.mlllm.', '..mmm..'];
        // The outline adds one art pixel on each side: core = 7 art pixels of 3 screen pixels
        TextureFactory.createGrid(scene, TextureFactory.bulletKey('orb', polarity), TextureFactory.outlined(orb),
            palette, 3, 'none', {hitRadius: 8, coreSize: 21});

        const needle = ion
            ? ['.l.', 'mlm', 'm.m', 'm.m', 'm.m', 'm.m', 'mlm', '.m.']
            : ['.w.', 'mwm', 'mlm', 'mwm', 'mlm', 'mwm', 'mlm', '.m.'];
        TextureFactory.createGrid(scene, TextureFactory.bulletKey('needle', polarity), TextureFactory.outlined(needle),
            palette, 3, 'cw', {hitRadius: 5, coreSize: 9});

        const bolt = ['.w.', 'lwl', 'lwl', 'mlm', 'mlm', 'mmm', '.d.'];
        TextureFactory.createGrid(scene, TextureFactory.bulletKey('bolt', polarity), TextureFactory.outlined(bolt),
            palette, 3, 'cw', {hitRadius: 8, coreSize: 9});
    }

    // ------------------------------------------------------------------ pickups

    private static createPickup(scene: Scene, type: PickupType, style: PickupStyle) {
        const palette: Palette = {...TextureFactory.NEUTRAL, f: style.color, F: TextureFactory.shade(style.color, 0.65)};
        const key = TextureFactory.pickupKey(type);

        if (type === 'credit') {
            const coin = ['..ooooo..', '.oyyyyyo.', 'oyywyyyDo', 'oywyyyyDo', 'oyyyyyyDo', 'oyyyyyyDo',
                'oyyyyyDDo', '.oyDDDDo.', '..ooooo..'];
            TextureFactory.createGrid(scene, key, coin, palette, 5, 'none');
            return;
        }

        const box = ['.ooooooooo.', 'offfffffffo', 'offfffffFFo', 'offfffffFFo', 'offfffffFFo', 'offfffffFFo',
            'offfffffFFo', 'offfffffFFo', 'offfffffFFo', 'oFFFFFFFFFo', '.ooooooooo.'];
        TextureFactory.createGrid(scene, key, box, palette, 6, 'none', undefined, (context, width, height) => {
            context.font = '24px pixel, monospace';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = TextureFactory.OUTLINE;
            context.fillText(style.symbol, width / 2 + 3, height / 2 + 3);
            context.fillStyle = '#f4f1e8';
            context.fillText(style.symbol, width / 2, height / 2);
        });
    }

    // ------------------------------------------------------------------ effects

    private static createEffects(scene: Scene) {
        TextureFactory.createCanvas(scene, TextureFactory.PARTICLE_KEY, 8, 8, (context) => {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, 8, 8);
        });
        TextureFactory.createCanvas(scene, TextureFactory.SPARK_KEY, 16, 4, (context) => {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, 16, 4);
        });

        // White so it can be tinted with any color; a dithered inner edge keeps it soft
        TextureFactory.createRing(scene, TextureFactory.RING_KEY, '#ffffff', 26, 4, 0);
        TextureFactory.createRing(scene, TextureFactory.SHIELD_KEY, '#7fcf8c', 20, 4, 0.25);

        const heart = ['.rr.rr.', 'rwrrrrr', 'rrrrrrR', '.rrrrR.', '..rrR..', '...R...'];
        TextureFactory.createGrid(scene, TextureFactory.LIFE_KEY, TextureFactory.outlined(heart),
            TextureFactory.NEUTRAL, 5, 'none');
    }

    /**
     * @param radius ring radius in art pixels of `cell` screen pixels
     * @param fillAlpha checkerboard fill inside the ring, 0 for none
     */
    private static createRing(scene: Scene, key: string, color: string, radius: number, cell: number, fillAlpha: number) {
        const size = (radius + 3) * 2;
        const grid: string[] = [];
        for (let y = 0; y < size; y++) {
            let row = '';
            for (let x = 0; x < size; x++) {
                const distance = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
                if (Math.abs(distance - radius) <= 1)
                    row += 'c';
                else if (fillAlpha > 0 && distance < radius - 1 && (x + y) % 2 === 0)
                    row += 'f';
                else
                    row += '.';
            }
            grid.push(row);
        }
        const fill = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${fillAlpha})`;
        TextureFactory.createGrid(scene, key, grid, {c: color, f: fill}, cell, 'none');
    }

    /** A calm dark sky: a lightly dithered base and two layers of square stars */
    private static createBackdrop(scene: Scene) {
        const size = 256;
        const random = TextureFactory.seededRandom(11);

        TextureFactory.createCanvas(scene, TextureFactory.NEBULA_KEY, size, size, (context) => {
            context.fillStyle = TextureFactory.SPACE;
            context.fillRect(0, 0, size, size);
            for (let i = 0; i < 260; i++) {
                context.fillStyle = random() < 0.5 ? '#151127' : '#120f22';
                context.fillRect(Math.floor(random() * size / 4) * 4, Math.floor(random() * size / 4) * 4, 4, 4);
            }
        });

        const stars = ['#5d566e', '#7a7290', '#9a93ab'];
        TextureFactory.createCanvas(scene, TextureFactory.STARS_FAR_KEY, size, size, (context) => {
            for (let i = 0; i < 40; i++) {
                context.fillStyle = stars[Math.floor(random() * stars.length)];
                context.fillRect(Math.floor(random() * size / 2) * 2, Math.floor(random() * size / 2) * 2, 2, 2);
            }
        });

        TextureFactory.createCanvas(scene, TextureFactory.STARS_NEAR_KEY, size, size, (context) => {
            for (let i = 0; i < 7; i++) {
                const x = 4 + Math.floor(random() * (size - 12) / 2) * 2;
                const y = 4 + Math.floor(random() * (size - 12) / 2) * 2;
                const bright = random() < 0.4;
                context.fillStyle = bright ? '#f4f1e8' : '#b9b2c9';
                context.fillRect(x, y, 2, 2);
                // A small cross on the brighter ones
                if (bright) {
                    context.fillStyle = '#7a7290';
                    context.fillRect(x - 2, y, 2, 2);
                    context.fillRect(x + 2, y, 2, 2);
                    context.fillRect(x, y - 2, 2, 2);
                    context.fillRect(x, y + 2, 2, 2);
                }
            }
        });
    }

    // ------------------------------------------------------------------ bosses

    private static createBoss(scene: Scene, key: string, boss: BossDef, polarity: Polarity) {
        const lowRes = document.createElement('canvas');
        lowRes.width = boss.size;
        lowRes.height = boss.size;
        const context = lowRes.getContext('2d')!;
        boss.draw(context, TextureFactory.SHADES[polarity]);

        // Back to clean pixels: no half transparent edge left by the canvas anti-aliasing
        const pixels = context.getImageData(0, 0, boss.size, boss.size).data;
        const grid: string[] = [];
        const palette: Palette = {};
        for (let y = 0; y < boss.size; y++) {
            let row = '';
            for (let x = 0; x < boss.size; x++) {
                const index = (y * boss.size + x) * 4;
                if (pixels[index + 3] < 128) {
                    row += '.';
                    continue;
                }
                const color = `#${[0, 1, 2].map(i => pixels[index + i].toString(16).padStart(2, '0')).join('')}`;
                let symbol = Object.keys(palette).find(k => palette[k] === color);
                if (!symbol) {
                    symbol = String.fromCharCode(0x100 + Object.keys(palette).length);
                    palette[symbol] = color;
                }
                row += symbol;
            }
            grid.push(row);
        }

        palette.o = TextureFactory.OUTLINE;
        const outlined = TextureFactory.outlined(grid);
        TextureFactory.createGrid(scene, key, outlined, palette, boss.cell, 'ccw',
            {hitRadius: boss.size * boss.cell * 0.36});
    }

    /** Disables anti-aliasing tricks: shapes are drawn with whole pixels in mind */
    private static ellipse(context: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number) {
        context.fillStyle = color;
        context.beginPath();
        context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        context.fill();
    }

    private static polygon(context: CanvasRenderingContext2D, color: string, points: number[]) {
        context.fillStyle = color;
        context.beginPath();
        for (let i = 0; i < points.length; i += 2) {
            if (i === 0)
                context.moveTo(points[i], points[i + 1]);
            else
                context.lineTo(points[i], points[i + 1]);
        }
        context.closePath();
        context.fill();
    }

    private static rect(context: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
        context.fillStyle = color;
        context.fillRect(x, y, w, h);
    }

    private static drawSaucer(c: CanvasRenderingContext2D, s: ShadeSet) {
        const n = TextureFactory.NEUTRAL;
        TextureFactory.ellipse(c, s.dark, 24, 28, 22, 9);
        TextureFactory.ellipse(c, s.mid, 24, 26, 21, 7);
        TextureFactory.ellipse(c, s.light, 24, 24, 17, 4);
        TextureFactory.ellipse(c, n.g, 24, 19, 11, 9);
        TextureFactory.ellipse(c, n.w, 21, 16, 4, 3);
        TextureFactory.rect(c, s.dark, 4, 26, 40, 2);
        for (let i = 0; i < 6; i++)
            TextureFactory.rect(c, i % 2 === 0 ? n.y : n.e, 7 + i * 6, 29, 3, 2);
        TextureFactory.polygon(c, n.G, [18, 35, 30, 35, 27, 40, 21, 40]);
        TextureFactory.rect(c, n.y, 22, 40, 4, 2);
    }

    private static drawDreadnought(c: CanvasRenderingContext2D, s: ShadeSet) {
        const n = TextureFactory.NEUTRAL;
        // Heavy hull pointing down at the player
        TextureFactory.polygon(c, s.dark, [24, 46, 34, 34, 40, 10, 32, 2, 16, 2, 8, 10, 14, 34]);
        TextureFactory.polygon(c, s.mid, [24, 42, 32, 32, 36, 11, 30, 4, 18, 4, 12, 11, 16, 32]);
        TextureFactory.polygon(c, s.light, [24, 36, 28, 28, 28, 10, 20, 10, 20, 28]);
        TextureFactory.polygon(c, s.dark, [2, 24, 10, 14, 12, 28, 4, 30]);
        TextureFactory.polygon(c, s.dark, [46, 24, 38, 14, 36, 28, 44, 30]);
        TextureFactory.rect(c, n.G, 7, 30, 3, 8);
        TextureFactory.rect(c, n.G, 38, 30, 3, 8);
        TextureFactory.rect(c, n.n, 21, 14, 6, 8);
        TextureFactory.rect(c, n.y, 22, 16, 4, 3);
        TextureFactory.rect(c, n.e, 18, 0, 4, 3);
        TextureFactory.rect(c, n.e, 26, 0, 4, 3);
    }

    private static drawOverlord(c: CanvasRenderingContext2D, s: ShadeSet) {
        const n = TextureFactory.NEUTRAL;
        // Spiked fortress around a big eye
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const tipX = 26 + Math.cos(angle) * 25;
            const tipY = 26 + Math.sin(angle) * 25;
            const leftX = 26 + Math.cos(angle - 0.3) * 15;
            const leftY = 26 + Math.sin(angle - 0.3) * 15;
            const rightX = 26 + Math.cos(angle + 0.3) * 15;
            const rightY = 26 + Math.sin(angle + 0.3) * 15;
            TextureFactory.polygon(c, i % 2 === 0 ? s.dark : n.G, [tipX, tipY, leftX, leftY, rightX, rightY]);
        }
        TextureFactory.ellipse(c, s.dark, 26, 26, 17, 17);
        TextureFactory.ellipse(c, s.mid, 26, 25, 15, 15);
        TextureFactory.ellipse(c, s.light, 24, 22, 9, 8);
        TextureFactory.ellipse(c, n.w, 26, 27, 10, 8);
        TextureFactory.ellipse(c, n.r, 26, 28, 5, 5);
        TextureFactory.ellipse(c, n.n, 26, 28, 2.5, 3.5);
        TextureFactory.rect(c, n.w, 23, 25, 2, 2);
    }

    private static drawOrchid(c: CanvasRenderingContext2D, s: ShadeSet) {
        const n = TextureFactory.NEUTRAL;
        const leaf = '#5e9c4a';
        const leafDark = '#2f5a2c';
        // Stem and leaves going down out of the screen
        TextureFactory.rect(c, leafDark, 24, 30, 5, 22);
        TextureFactory.rect(c, leaf, 25, 30, 2, 22);
        TextureFactory.polygon(c, leafDark, [26, 40, 6, 32, 10, 44]);
        TextureFactory.polygon(c, leaf, [26, 40, 9, 34, 12, 42]);
        TextureFactory.polygon(c, leafDark, [27, 44, 47, 36, 43, 48]);
        TextureFactory.polygon(c, leaf, [27, 44, 44, 38, 41, 46]);
        // Five petals in the polarity color
        for (let i = 0; i < 5; i++) {
            const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
            TextureFactory.ellipse(c, s.dark, 26 + Math.cos(angle) * 13, 22 + Math.sin(angle) * 13, 9, 9);
            TextureFactory.ellipse(c, s.mid, 26 + Math.cos(angle) * 13, 21 + Math.sin(angle) * 13, 7.5, 7.5);
            TextureFactory.ellipse(c, s.light, 25 + Math.cos(angle) * 14, 19 + Math.sin(angle) * 14, 3, 3);
        }
        // A wide flytrap mouth instead of a face: friendly from afar only
        TextureFactory.ellipse(c, n.y, 26, 22, 10, 10);
        TextureFactory.ellipse(c, n.D, 26, 24, 9, 7);
        TextureFactory.ellipse(c, n.R, 26, 24, 7, 4.5);
        for (let i = 0; i < 5; i++) {
            TextureFactory.polygon(c, n.w, [20 + i * 3, 20, 22 + i * 3, 20, 21 + i * 3, 23]);
            TextureFactory.polygon(c, n.w, [20 + i * 3, 28, 22 + i * 3, 28, 21 + i * 3, 25]);
        }
    }

    private static drawBlade(c: CanvasRenderingContext2D, s: ShadeSet) {
        const n = TextureFactory.NEUTRAL;
        // Two curved steel blades
        TextureFactory.polygon(c, n.G, [14, 14, 2, 22, 4, 40, 8, 26, 16, 20]);
        TextureFactory.polygon(c, n.g, [13, 16, 4, 23, 5, 34, 8, 25]);
        TextureFactory.polygon(c, n.G, [34, 14, 46, 22, 44, 40, 40, 26, 32, 20]);
        TextureFactory.polygon(c, n.g, [35, 16, 44, 23, 43, 34, 40, 25]);
        // Slim armored body, pointing down
        TextureFactory.polygon(c, s.dark, [24, 46, 32, 30, 32, 10, 24, 2, 16, 10, 16, 30]);
        TextureFactory.polygon(c, s.mid, [24, 42, 30, 29, 30, 11, 24, 5, 18, 11, 18, 29]);
        TextureFactory.polygon(c, s.light, [24, 36, 27, 28, 27, 12, 24, 9, 21, 12, 21, 28]);
        // Single visor slit
        TextureFactory.rect(c, n.n, 19, 16, 10, 4);
        TextureFactory.rect(c, n.r, 20, 17, 8, 2);
        TextureFactory.rect(c, n.e, 22, 0, 4, 4);
    }

    // ------------------------------------------------------------------ helpers

    /** Adds a one pixel outline around every opaque pixel, and the room for it */
    private static outlined(grid: PixelGrid): PixelGrid {
        const width = Math.max(...grid.map(row => [...row].length)) + 2;
        const rows = [new Array(width).fill('.'), ...grid.map(row => ['.', ...[...row].concat(new Array(width - 2 - [...row].length).fill('.')), '.']), new Array(width).fill('.')];
        const result = rows.map(row => [...row]);
        for (let y = 0; y < rows.length; y++) {
            for (let x = 0; x < width; x++) {
                if (rows[y][x] !== '.')
                    continue;
                const neighbors = [rows[y - 1]?.[x], rows[y + 1]?.[x], rows[y][x - 1], rows[y][x + 1]];
                if (neighbors.some(value => value !== undefined && value !== '.' && value !== 'o'))
                    result[y][x] = 'o';
            }
        }
        return result.map(row => row.join(''));
    }

    private static createGrid(scene: Scene, key: string, grid: PixelGrid, palette: Palette, cell: number,
                              rotation: Rotation, bodyData?: TextureBodyData,
                              decorate?: (context: CanvasRenderingContext2D, width: number, height: number) => void) {
        const rows = grid.map(row => [...row]);
        const columns = Math.max(...rows.map(row => row.length));
        const turned = rotation !== 'none';
        const width = (turned ? rows.length : columns) * cell;
        const height = (turned ? columns : rows.length) * cell;

        TextureFactory.createCanvas(scene, key, width, height, (context) => {
            rows.forEach((row, r) => row.forEach((symbol, c) => {
                const color = palette[symbol];
                if (symbol === '.' || !color)
                    return;

                let x = c;
                let y = r;
                if (rotation === 'cw') {
                    x = rows.length - 1 - r;
                    y = c;
                } else if (rotation === 'ccw') {
                    x = r;
                    y = columns - 1 - c;
                }
                context.fillStyle = color;
                context.fillRect(x * cell, y * cell, cell, cell);
            }));
            decorate?.(context, width, height);
        }, bodyData);
    }

    /** "#rrggbb" darkened by factor */
    private static shade(hex: string, factor: number): string {
        const value = parseInt(hex.slice(1), 16);
        const channel = (shift: number) => Math.round(((value >> shift) & 255) * factor).toString(16).padStart(2, '0');
        return `#${channel(16)}${channel(8)}${channel(0)}`;
    }

    /** Same sky on every launch */
    private static seededRandom(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state + 0x6d2b79f5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    private static createCanvas(scene: Scene, key: string, width: number, height: number,
                                draw: (context: CanvasRenderingContext2D) => void, bodyData?: TextureBodyData) {
        if (scene.textures.exists(key))
            return;

        const texture = scene.textures.createCanvas(key, width, height);
        if (!texture)
            return;

        const context = texture.getContext();
        context.imageSmoothingEnabled = false;
        draw(context);
        texture.refresh();
        if (bodyData)
            texture.customData = bodyData;
    }
}

