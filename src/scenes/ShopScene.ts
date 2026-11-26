import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import {upgradeCost, UpgradesData} from "../gameData/UpgradeData.ts";
import Progress from "../managers/Progress.ts";
import SaveManager from "../managers/SaveManager.ts";
import Button, {ButtonStyle} from "../ui/Button.ts";
import TextureFactory from "../utils/TextureFactory.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";


/**
 * Spends banked credits on permanent upgrades and ships. Rebuilt after each purchase.
 */
export default class ShopScene extends Scene {
    private static readonly BUY_BUTTON: ButtonStyle = {width: 280, height: 130, fontSize: 40, fillColor: UiStyle.PANEL};
    private static readonly SHIP_BUTTON: ButtonStyle = {width: 300, height: 100, fontSize: 34, fillColor: UiStyle.PANEL};
    private static readonly FIRST_UPGRADE_Y: number = 400;
    private static readonly UPGRADE_ROW_HEIGHT: number = 170;
    private static readonly SHIPS_Y: number = 1440;
    private static readonly LEFT_X: number = 60;

    private saveManager: SaveManager;
    private _content: GameObjects.GameObject[] = [];

    constructor() {
        super(GameConstants.SceneKeys.SHOP);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this._content = [];
        new Backdrop(this, 0.5);
        this.add.text(this.scale.width / 2, 130, 'BOUTIQUE', UiStyle.text(100)).setOrigin(0.5);
        new Button(this, this.scale.width / 2, 1845, 'RETOUR', () => this.scene.start(GameConstants.SceneKeys.HOME));

        this.build();
    }

    private build() {
        this._content.forEach(object => object.destroy());
        this._content = [];

        const credits = Progress.getCredits(this.saveManager);
        this.track(this.add.text(this.scale.width / 2, 250, `$ ${credits}`,
            UiStyle.text(64, '#ffd166', '#ffb347')).setOrigin(0.5));

        this.buildUpgrades(credits);
        this.buildShips(credits);
    }

    private buildUpgrades(credits: number) {
        const data = this.cache.json.get(GameConstants.DataKeys.UPGRADES) as UpgradesData;
        const levels = Progress.getUpgradeLevels(this.saveManager);

        Object.entries(data.upgrades).forEach(([key, upgrade], index) => {
            const y = ShopScene.FIRST_UPGRADE_Y + index * ShopScene.UPGRADE_ROW_HEIGHT;
            const level = levels[key] ?? 0;
            const maxed = level >= upgrade.maxLevel;
            const cost = upgradeCost(upgrade, level);

            this.track(this.add.text(ShopScene.LEFT_X, y - 50, UiStyle.upper(upgrade.name),
                UiStyle.text(46)));
            this.track(this.add.text(ShopScene.LEFT_X, y + 6, upgrade.description, UiStyle.body(32)));
            for (let pip = 0; pip < upgrade.maxLevel; pip++) {
                this.track(this.add.rectangle(ShopScene.LEFT_X + pip * 52, y + 64, 40, 18,
                    pip < level ? UiStyle.SUCCESS : UiStyle.PANEL).setOrigin(0, 0.5).setStrokeStyle(2, UiStyle.SUCCESS));
            }

            const button = new Button(this, this.scale.width - 200, y + 10, maxed ? 'MAX' : `$ ${cost}`, () => {
                if (Progress.spendCredits(this.saveManager, cost)) {
                    Progress.setUpgradeLevel(this.saveManager, key, level + 1);
                    this.build();
                }
            }, ShopScene.BUY_BUTTON).setEnabled(!maxed && credits >= cost);
            this.track(button);
        });
    }

    private buildShips(credits: number) {
        const ships = this.cache.json.get(GameConstants.DataKeys.PLAYER_SHIPS) as PlayerShipsData;
        const unlocked = Progress.getUnlockedShips(this.saveManager);
        const selected = Progress.getSelectedShip(this.saveManager);
        const entries = Object.entries(ships);
        const columnWidth = this.scale.width / entries.length;

        this.track(this.add.text(this.scale.width / 2, ShopScene.SHIPS_Y - 80, 'VAISSEAUX',
            UiStyle.text(46)).setOrigin(0.5));

        entries.forEach(([idText, ship], index) => {
            const id = Number(idText);
            const x = columnWidth * (index + 0.5);
            const owned = unlocked.includes(id);

            this.track(this.add.image(x, ShopScene.SHIPS_Y, TextureFactory.shipKey(ship.texture, index % 2 === 0 ? 'ion' : 'plasma')).setAngle(-90)
                .setAlpha(owned ? 1 : 0.5));
            this.track(this.add.text(x, ShopScene.SHIPS_Y + 70, UiStyle.upper(ship.name),
                UiStyle.text(30)).setOrigin(0.5));
            this.track(this.add.text(x, ShopScene.SHIPS_Y + 108, ship.description,
                {...UiStyle.body(22), align: 'center', wordWrap: {width: columnWidth - 30}}).setOrigin(0.5, 0));

            let label: string;
            let enabled: boolean;
            let onClick: () => void;
            if (id === selected) {
                label = 'CHOISI';
                enabled = false;
                onClick = () => {};
            } else if (owned) {
                label = 'CHOISIR';
                enabled = true;
                onClick = () => Progress.selectShip(this.saveManager, id);
            } else {
                label = `$ ${ship.price}`;
                enabled = credits >= ship.price;
                onClick = () => {
                    if (Progress.spendCredits(this.saveManager, ship.price)) {
                        Progress.unlockShip(this.saveManager, id);
                        Progress.selectShip(this.saveManager, id);
                    }
                };
            }

            this.track(new Button(this, x, ShopScene.SHIPS_Y + 210, label, () => {
                onClick();
                this.build();
            }, ShopScene.SHIP_BUTTON).setEnabled(enabled));
        });
    }

    private track<T extends GameObjects.GameObject>(object: T): T {
        this._content.push(object);
        return object;
    }
}
