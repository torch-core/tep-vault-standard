import "../../constants/common-types";
import "../../types/asset";
import "../../types/vault-result";
import "../../types/callback-params";

// ===== JETTON TRANSFER MESSAGES =====
struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: QueryId
    depositAmount: coins
    initiator: address
    forwardPayload: Cell<DepositFp>?
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

struct (0x7bdd97de) BurnNotificationForMinter {
    queryId: QueryId
    shares: coins
    initiator: address
    sendExcessesTo: address
    customPayload: Cell<WithdrawParamsFp>?
}

struct (0x2c76b973) RequestWalletAddress {
    queryId: uint64
    ownerAddress: address
    includeOwnerAddress: bool
}

struct (0xd1735400) ResponseWalletAddress {
    queryId: uint64
    jettonWalletAddress: address
    ownerAddress: Cell<address>?
}

// ===== COMMON PARAMETERS =====
struct OptionalParams {
    // Add your optional params for vault here
}

struct Callbacks {
    successCallback: Cell<CallbackParams>? = null
    failureCallback: Cell<CallbackParams>? = null
}

struct VaultNotificationParams {
    result: Result
    initiator: address
    callbackPayload: cell?
    inMsg: cell?
}

// ===== DEPOSIT MESSAGES =====
struct DepositParams {
    receiver: address
    minShares: coins = 0
    optionalParams: Cell<OptionalParams>? = null
    callbacks: Callbacks
}
struct (0x7ceea8a6) Deposit {
    queryId: QueryId
    depositAmount: coins
    depositParams: DepositParams
}

struct (0x97afc71b) DepositFp {
    depositParams: DepositParams
}

// ===== WITHDRAW MESSAGES =====
struct (0xa1242cde) WithdrawParamsFp {
    receiver: address
    minWithdraw: coins = 0
    optionalParams: Cell<OptionalParams>? = null
    callbacks: Callbacks
}

// ===== NOTIFICATION MESSAGES =====
struct (0x13aec42d) VaultNotification {
    queryId: QueryId
    vaultNotificationParams: VaultNotificationParams
}

struct (0xb00d7656) VaultNotificationFp {
    vaultNotificationParams: VaultNotificationParams
}

// ===== DEPLOY VAULT MESSAGES =====
struct (0xe43f93a9) DeployVault {
    queryId: QueryId
}

const OP_VAULT_DEPOSIT = Deposit.getDeclaredPackPrefix();
const OP_VAULT_DEPOSIT_FP = DepositFp.getDeclaredPackPrefix();
const OP_TRANSFER_NOTIFICATION_FOR_RECIPIENT = TransferNotificationForRecipient.getDeclaredPackPrefix();
const OP_BURN_NOTIFICATION_FOR_MINTER = BurnNotificationForMinter.getDeclaredPackPrefix();
const OP_VAULT_WITHDRAW_FP = WithdrawParamsFp.getDeclaredPackPrefix();
const OP_DEPLOY_VAULT = DeployVault.getDeclaredPackPrefix();

type AllowedMessage = Deposit | TransferNotificationForRecipient | BurnNotificationForMinter | DeployVault | ResponseWalletAddress;