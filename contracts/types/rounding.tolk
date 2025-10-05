import "../constants/errors";

enum RoundingType {
    Down,
    Up,
    HalfUp,
}

fun roundedMulDiv(x: int, y: int, z: int, rounding: RoundingType) {
    match (rounding) {
        RoundingType.Down => {
            return mulDivFloor(x, y, z);
        }
        RoundingType.Up => {
            return mulDivCeil(x, y, z);
        }
        RoundingType.HalfUp => {
            return mulDivRound(x, y, z);
        }
    }
    throw ERR_INVALID_ROUNDING_TYPE;
}