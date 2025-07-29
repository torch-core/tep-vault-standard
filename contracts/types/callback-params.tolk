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
fun CallbackParams.defaultSuccessDeposit(): Cell<CallbackParams> {
    return CallbackParams { payload: CommentPayload { comment: "Vault deposit completed - shares minted" }.toCell() }.toCell();
}

@pure
fun CallbackParams.defaultFailureDeposit(): Cell<CallbackParams> {
    return CallbackParams { payload: CommentPayload { comment: "Vault deposit failed - assets refunded" }.toCell() }.toCell();
}

@pure
fun CallbackParams.defaultSuccessWithdraw(): Cell<CallbackParams> {
    return CallbackParams { payload: CommentPayload { comment: "Vault withdrawal completed - assets transferred" }.toCell() }.toCell();
}

@pure
fun CallbackParams.defaultFailureWithdraw(): Cell<CallbackParams> {
    return CallbackParams { payload: CommentPayload { comment: "Vault withdrawal failed - shares refunded" }.toCell() }.toCell();
}