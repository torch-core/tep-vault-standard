import "../../types/asset";
import "../../types/vault-result";
import "../../constants/common-types";

// ===== JETTON TRANSFER MESSAGES =====
struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: QueryId
    jettonAmount: coins
    transferInitiator: address
    forwardPayload: VaultDepositFp
}

struct (0x178d4519) InternalTransferStep {
    queryId: QueryId
    jettonAmount: coins
    transferInitiator: address
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

struct (0x7bdd97de) BurnNotificationForMinter {
    queryId: QueryId
    jettonAmount: coins
    burnInitiator: address
    sendExcessesTo: address
    customPayload: Cell<VaultWithdrawFp>
}

// ===== COMMON PARAMETERS =====
struct CallbackParams {
    includeBody: bool
    payload: cell
}

struct PayloadParams {
    successCallback: CallbackParams? = null
    failureCallback: CallbackParams? = null
    optionalPayload: cell? = null
}

struct VaultNotificationParams {
    vaultResult: VaultResult
    initiator: address
    callbackPayload: cell
    inMsgPayload: cell?
}

// ===== DEPOSIT MESSAGES =====
struct VaultDepositParams {
    receiver: address?
    minShares: coins?
    payloadParams: PayloadParams
}
struct (0x7ceea8a6) VaultDeposit {
    queryId: QueryId
    depositAmount: coins
    vaultDepositParams: VaultDepositParams?
}

struct (0x97afc71b) VaultDepositFp {
    vaultDepositParams: VaultDepositParams?
}

// ===== WITHDRAW MESSAGES =====
struct (0xa1242cde) VaultWithdrawFp {
    receiver: address?
    withdrawAsset: Cell<Asset>?
    minWithdraw: coins?
    payloadParams: PayloadParams
}

// ===== NOTIFICATION MESSAGES =====
struct (0x13aec42d) VaultNotification {
    queryId: QueryId
    vaultNotificationParams: VaultNotificationParams
}

struct (0xb00d7656) VaultNotificationFp {
    vaultNotificationParams: VaultNotificationParams
}

const OP_VAULT_DEPOSIT = VaultDeposit.getDeclaredPackPrefix();
const OP_VAULT_DEPOSIT_FP = VaultDepositFp.getDeclaredPackPrefix();
const OP_TRANSFER_NOTIFICATION_FOR_RECIPIENT = TransferNotificationForRecipient.getDeclaredPackPrefix();
const OP_BURN_NOTIFICATION_FOR_MINTER = BurnNotificationForMinter.getDeclaredPackPrefix();
const OP_VAULT_WITHDRAW_FP = VaultWithdrawFp.getDeclaredPackPrefix();

type AllowedMessage = VaultDeposit | TransferNotificationForRecipient | BurnNotificationForMinter;