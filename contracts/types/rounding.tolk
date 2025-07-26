import "../constants/errors";

type RoundingType = uint2;
const ROUND_DOWN = 0;
const ROUND_UP = 1;
const ROUND_GENERIC = 2;

fun RoundingType.Down() {
    return ROUND_DOWN;
}

fun RoundingType.Up() {
    return ROUND_UP;
}

fun RoundingType.Generic() {
    return ROUND_GENERIC;
}

fun roundedMulDiv(x: int, y: int, z: int, rounding: RoundingType) {
    match (rounding) {
        ROUND_DOWN => {
            return mulDivFloor(x, y, z);
        }
        ROUND_UP => {
            return mulDivCeil(x, y, z);
        }
        ROUND_GENERIC => {
            return mulDivRound(x, y, z);
        }
        else => {
            throw ERR_INVALID_ROUNDING_TYPE;
        }
    }
}