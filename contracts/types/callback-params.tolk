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
fun CallbackParams.defaultSuccessDeposit(): CallbackParams {
    return CallbackParams { payload: CommentPayload { comment: "Vault deposit completed - shares minted" }.toCell() };
}

@pure
fun CallbackParams.defaultFailureDeposit(): CallbackParams {
    return CallbackParams { payload: CommentPayload { comment: "Vault deposit failed - assets refunded" }.toCell() };
}

@pure
fun CallbackParams.defaultSuccessWithdraw(): CallbackParams {
    return CallbackParams { payload: CommentPayload { comment: "Vault withdrawal completed - assets transferred" }.toCell() };
}

@pure
fun CallbackParams.defaultFailureWithdraw(): CallbackParams {
    return CallbackParams { payload: CommentPayload { comment: "Vault withdrawal failed - shares refunded" }.toCell() };
}