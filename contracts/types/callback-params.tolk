import "../constants/common-types"

struct CallbackParams {
    includeBody: bool = false
    payload: cell
}

struct CommentPayload {
    opcode: Opcode = 0;
    action: slice;
    message: slice;
}

@pure
fun CallbackParams.defaultSuccess(action: slice) {
    return CallbackParams { payload: CommentPayload { action: action, message: " successful" }.toCell() };
}

@pure
fun CallbackParams.defaultFailure(action: slice) {
    return CallbackParams { payload: CommentPayload { action: action, message: " failed" }.toCell() };
}