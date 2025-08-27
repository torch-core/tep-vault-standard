import "../../constants/common-types"
import "../../types/asset"
import "common"

struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: QueryId
    depositAmount: coins
    initiator: address
    forwardPayload: Cell<DepositFp>?
}

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
    vaultConfig: Cell<VaultConfig>? = null
    // Internal configuration struct for deposit operations, resolved from DepositOptions.
}

// Logs
struct DepositLogOptions {
    // Add fields base on your needs
    // Leave it empty if you don't need any extra logs
}

struct(0x11475d67) Deposited {
    initiator: address
    receiver: address
    depositAsset: Cell<Asset>? = null
    depositAmount: coins
    shares: coins
    depositLogOptions: Cell<DepositLogOptions>? = null
}


const TOPIC_DEPOSITED = Deposited.getDeclaredPackPrefix();