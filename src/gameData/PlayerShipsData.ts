import {ShipBodyData} from "./ShipBodyData.ts";
import type {PlayerStats} from "./UpgradeData.ts";

export type PlayerShipsData = {
    [key: string]: PlayerShipData
}

export type PlayerShipData = {
    name: string;
    description: string;
    /** Added to the upgraded stats */
    bonus: Partial<PlayerStats>;
    /** Credits to unlock it in the shop, 0 for the starting ship */
    price: number;
    movementSpeed: number;
    texture: string;
    body: ShipBodyData;
}