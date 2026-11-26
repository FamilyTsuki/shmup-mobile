import type {MovementData} from "../../gameData/EnemyData.ts";
import ChaseMovement from "./ChaseMovement.ts";
import EnemyMovement from "./EnemyMovement.ts";
import HoverMovement from "./HoverMovement.ts";
import SineMovement from "./SineMovement.ts";
import StraightMovement from "./StraightMovement.ts";
import CrossMovement from "./CrossMovement.ts";

export default function createEnemyMovement(data: MovementData): EnemyMovement {
    switch (data.type) {
        case 'sine':
            return new SineMovement(data.frequency, data.amplitude);
        case 'chase':
            return new ChaseMovement(data.horizontalSpeed);
        case 'hover':
            return new HoverMovement(data.stopY, data.stayMs, data.swayAmplitude);
        case 'straight':
            return new StraightMovement();
        case 'cross':
            return new CrossMovement(data.minY, data.maxY);
    }
}
