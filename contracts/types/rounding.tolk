import "../constants/errors";

type RoundingType = uint2;

const ROUND_DOWN = 0;
const ROUND_UP = 1;
const ROUND_HALF_UP = 2;

@pure
fun RoundingType.Down() {
    return ROUND_DOWN;
}

@pure
fun RoundingType.Up() {
    return ROUND_UP;
}

@pure
fun RoundingType.HalfUp() {
    return ROUND_HALF_UP;
}

fun roundedMulDiv(x: int, y: int, z: int, rounding: RoundingType) {
    match (rounding) {
        ROUND_DOWN => {
            return mulDivFloor(x, y, z);
        }
        ROUND_UP => {
            return mulDivCeil(x, y, z);
        }
        ROUND_HALF_UP => {
            return mulDivRound(x, y, z);
        }
        else => {
            throw ERR_INVALID_ROUNDING_TYPE;
        }
    }
}