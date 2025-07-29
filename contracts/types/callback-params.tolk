import "../constants/common-types"

struct CallbackParams {
    includeBody: bool = false
    payload: cell
}

struct CommentPayload {
    opcode: Opcode = 0;
    comment: slice;
}

@pure
fun CallbackParams.defaultSuccess(): CallbackParams {
    return CallbackParams { payload: CommentPayload { comment: "Vault interaction successful" }.toCell() };
}

@pure
fun CallbackParams.defaultFailure(): CallbackParams {
    return CallbackParams { payload: CommentPayload { comment: "Vault interaction failed" }.toCell() };
}