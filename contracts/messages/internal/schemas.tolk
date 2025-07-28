import "../../constants/common-types";
import "../../types/asset";
import "../../types/vault-result";
import "../../types/callback-params";

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
struct OptionalVaultParams {
    // Add your optional params for vault here
}

struct VaultCallbacks {
    successCallback: CallbackParams? = null
    failureCallback: CallbackParams? = null
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
    optionalVaultParams: Cell<OptionalVaultParams>? = null
    vaultCallbacks: VaultCallbacks
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
    minWithdraw: coins?
    optionalVaultParams: Cell<OptionalVaultParams>? = null
    vaultCallbacks: VaultCallbacks
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