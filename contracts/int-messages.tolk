import "role-authority/int-messages";
import "role-authority/constants/type";

struct CallbackParams {
    includeBody: bool
    callbackPayload: cell
}

struct VaultDepositParams {
    receiver: address
    minMint: coins
    sucPayload: CallbackParams?
    failPayload: CallbackParams?
    optPayload: cell?
}

// For Native Deposit
struct (0x7ceea8a6) VaultDeposit {
    queryId: QueryId
    depositAmount: coins
    vaultDepositParams: VaultDepositParams
}

// For Jetton Deposit
struct (0x97afc71b) VaultDepositFp {
    vaultDepositParams: VaultDepositParams
}

struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: QueryId
    jettonAmount: coins
    transferInitiator: address
    forwardPayload: VaultDepositFp
}

const OP_VAULT_DEPOSIT = VaultDeposit.getDeclaredPackPrefix();
const OP_VAULT_DEPOSIT_FP = VaultDepositFp.getDeclaredPackPrefix();
const OP_TRANSFER_NOTIFICATION_FOR_RECIPIENT = TransferNotificationForRecipient.getDeclaredPackPrefix();

type AllowedMessage = AuthMessages | VaultDeposit | TransferNotificationForRecipient;