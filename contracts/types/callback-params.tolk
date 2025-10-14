import "../constants/common-types"

struct CallbackParams {
    includeBody: bool = false
    payload: cell
}

struct CommentPayload {
    private readonly opcode: Opcode = 0;
    action: slice;
    message: slice;
}

@pure
fun CallbackParams.defaultSuccess(action: slice = "Operation") {
    return CallbackParams { payload: CommentPayload { action: action, message: " successful" }.toCell() };
}

@pure
fun CallbackParams.defaultFailure(action: slice = "Operation") {
    return CallbackParams { payload: CommentPayload { action: action, message: " failed" }.toCell() };
}

@pure
fun resolveSuccessCallback(successCallback: Cell<CallbackParams>?): CallbackParams {
    return successCallback != null ? successCallback.load() : CallbackParams.defaultSuccess();
}

@pure
fun resolveFailureCallback(failureCallback: Cell<CallbackParams>?): CallbackParams {
    return failureCallback != null ? failureCallback.load() : CallbackParams.defaultFailure();
}