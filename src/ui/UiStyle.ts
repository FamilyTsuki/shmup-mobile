import type {Types} from "phaser";

/**
 * Shared look of every menu and HUD element: retro pixel font, flat dark panels, soft colors.
 */
export default class UiStyle {
    public static readonly FONT: string = 'pixel';
    /** Dark panel behind buttons and gauges */
    public static readonly PANEL: number = 0x221b36;
    /** Panel border */
    public static readonly CHROME: number = 0x9a93ab;
    public static readonly CHROME_CSS: string = '#9a93ab';
    public static readonly MUTED_CSS: string = '#9a93ab';
    public static readonly TEXT_CSS: string = '#f4f1e8';
    public static readonly SUCCESS: number = 0x5fae6e;
    public static readonly OUTLINE_CSS: string = '#1a1426';

    /**
     * The pixel font is wide: sizes from the older layouts are scaled down to keep the same footprint.
     * @param _accent kept for call sites that pass a highlight color; the pixel style has no glow
     */
    public static text(size: number, color: string = UiStyle.TEXT_CSS, _accent?: string): Types.GameObjects.Text.TextStyle {
        const fontSize = UiStyle.pixelSize(size * 0.62);
        return {
            fontSize: `${fontSize}px`,
            color,
            fontFamily: UiStyle.FONT,
            stroke: UiStyle.OUTLINE_CSS,
            strokeThickness: Math.max(4, Math.round(fontSize / 4)),
            // Hard drop shadow, the retro way
            shadow: {color: UiStyle.OUTLINE_CSS, blur: 0, fill: true, stroke: true, offsetX: 0, offsetY: Math.max(3, Math.round(fontSize / 6))},
            padding: {x: 4, y: 6},
        };
    }

    /** Smaller readable text: descriptions, help */
    public static body(size: number, color: string = UiStyle.MUTED_CSS): Types.GameObjects.Text.TextStyle {
        return {fontSize: `${UiStyle.pixelSize(size * 0.6)}px`, color, fontFamily: UiStyle.FONT, lineSpacing: 8};
    }

    /**
     * Upper case without accents: the pixel font draws accented capitals like small letters
     */
    public static upper(text: string): string {
        return UiStyle.plainCapitals(text.toUpperCase());
    }

    /** Removes the accents of capital letters only, for mixed case text from the data files */
    public static plainCapitals(text: string): string {
        return text.replace(/[À-ÖØ-Þ]/g, letter => letter.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    }

    /** The font is drawn on an 8 px grid: stay on multiples of 4 to keep it sharp */
    private static pixelSize(size: number): number {
        return Math.max(16, Math.round(size / 4) * 4);
    }
}
