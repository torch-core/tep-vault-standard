import "../../constants/common-types"
import "../../types/asset"
import "common"

struct (0x7bdd97de) VaultBurnNotification {
    queryId: QueryId
    shares: coins
    initiator: address
    sendExcessesTo: address
    customPayload: Cell<WithdrawFp>?
}

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
    vaultConfig: Cell<VaultConfig>? = null
    // Internal configuration struct for withdraw operations, resolved from WithdrawOptions.
}   

// Logs
struct WithdrawLogOptions {
    // Add fields base on your needs
    // Leave it empty if you don't need any extra logs
}

struct (0xedfb416d) Withdrawn {
    initiator: address
    receiver: address
    withdrawAsset: Cell<Asset>
    withdrawAmount: coins
    burnedShares: coins
    vaultStateAfter: Cell<VaultStateAfter>
    withdrawLogOptions: Cell<WithdrawLogOptions>? = null
}
const TOPIC_WITHDRAWN = Withdrawn.getDeclaredPackPrefix();