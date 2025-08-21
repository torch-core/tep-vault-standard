import "../../constants/common-types";
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
    customPayload: Cell<WithdrawFp>?
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
struct VaultOptions {
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
    inBody: cell?
}

// ===== DEPOSIT MESSAGES =====
struct DepositOptions {
    vaultOptions: Cell<VaultOptions>? = null
    // Add your optional params for vault here
}
struct DepositParams {
    receiver: address
    minShares: coins = 0
    depositOptions: Cell<DepositOptions>? = null
    callbacks: Callbacks
}
struct (0x5a66a4a5) Deposit {
    queryId: QueryId
    depositAmount: coins
    depositParams: DepositParams
}

struct (0xb534fe7b) DepositFp {
    depositParams: DepositParams
}
struct DepositConfig {
    // Internal configuration struct for deposit operations, resolved from DepositOptions.
}

// ===== WITHDRAW MESSAGES =====
struct WithdrawOptions {
    vaultOptions: Cell<VaultOptions>? = null
    // Add your optional params for vault here
}
struct (0xecb4d6bf) WithdrawFp {
    receiver: address
    minWithdraw: coins = 0
    withdrawOptions: Cell<WithdrawOptions>? = null
    callbacks: Callbacks
}

struct WithdrawConfig {
    // Internal configuration struct for withdraw operations, resolved from WithdrawOptions.
}   

// ===== NOTIFICATION MESSAGES =====
struct (0x86eba146) VaultNotification {
    queryId: QueryId
    vaultNotificationParams: VaultNotificationParams
}

struct (0xb00d7656) VaultNotificationFp {
    vaultNotificationParams: VaultNotificationParams
}

// ===== Provide Quote Messages =====
struct OptionalQuoteParams {
    // Add your optional params based on your needs
    // Leave it empty if you don't need any extra params
}

struct (0xc643cc91) ProvideQuote {
    queryId: QueryId
    receiver: address
    optionalQuoteParams: Cell<OptionalQuoteParams>? = null
    forwardPayload: cell?
}

struct (0x68ec31ea) TakeQuote {
    queryId: QueryId
    initiator: address
    totalSupply: coins
    totalAssets: coins
    timestamp: Timestamp
    forwardPayload: cell?
}

// ===== DEPLOY VAULT MESSAGES =====
struct (0xe43f93a9) DeployVault {
    queryId: QueryId
}

type AllowedMessage = Deposit | TransferNotificationForRecipient | BurnNotificationForMinter | DeployVault | ResponseWalletAddress | ProvideQuote;