import "../../constants/common-types"
import "../../types/callback-params"
import "../../types/vault-result"

struct VaultOptions {
    // Add your optional params for vault here
}

struct VaultConfig {
    // Internal configuration struct for vault operations, resolved from VaultOptions.
}   

struct Callbacks {
    successCallback: Cell<CallbackParams>? = null
    failureCallback: Cell<CallbackParams>? = null
}

struct VaultNotificationParams {
    result: Result
    initiator: address
    callbackPayload: cell?
    inBody: cell?
}

struct (0x86eba146) VaultNotification {
    queryId: QueryId
    vaultNotificationParams: VaultNotificationParams
}

struct (0xb00d7656) VaultNotificationFp {
    vaultNotificationParams: VaultNotificationParams
}

struct (0x1f9e644b) VaultNotificationEc {
    queryId: QueryId
    vaultNotificationParams: VaultNotificationParams
}

struct (0x178d4519) InternalTransferStep {
    queryId: QueryId
    jettonAmount: coins
    initiator: address
    sendExcessesTo: address
    forwardTonAmount: coins
    forwardPayload: Cell<VaultNotificationFp>?
}

struct (0x0f8a7ea5) AskToTransfer {
    queryId: uint64
    jettonAmount: coins
    transferRecipient: address
    sendExcessesTo: address
    customPayload: cell?
    forwardTonAmount: coins
    forwardPayload: Cell<VaultNotificationFp>?
}

struct TxContext {
    initiator: address;
    queryId: QueryId;
    remainingValue: coins;
    inBody: slice;
}