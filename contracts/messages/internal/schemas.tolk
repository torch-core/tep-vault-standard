import "../../types/asset";
import "../../types/vault-result";
import "../../constants/common-types";

// Jetton Messages
struct (0x7bdd97de) BurnNotificationForMinter {
    queryId: QueryId
    jettonAmount: coins
    burnInitiator: address
    sendExcessesTo: address
    customPayload: Cell<VaultWithdrawFp>
}

struct CallbackParams {
    includeBody: bool
    callbackPayload: cell
}

struct VaultDepositParams {
    receiver: address?
    minShares: coins?
    successPayload: CallbackParams?
    failurePayload: CallbackParams?
    optionalPayload: cell?
}

// For Native Deposit
struct (0x7ceea8a6) VaultDeposit {
    queryId: QueryId
    depositAmount: coins
    vaultDepositParams: VaultDepositParams?
}

// For Jetton Deposit
struct (0x97afc71b) VaultDepositFp {
    vaultDepositParams: VaultDepositParams?
}

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

// For Withdraw
struct (0xa1242cde) VaultWithdrawFp {
    receiver: address?
    withdrawAsset: Cell<Asset>?
    minWithdraw: coins?
    successPayload: CallbackParams?
    failurePayload: CallbackParams?
    optionalPayload: cell?
}

struct VaultNotificationParams {
    status: VaultResult
    initiator: address
    callbackPayload: cell
    inMsgPayload: cell?
}

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