import "../../types/asset"
import "../../constants/common-types"

struct OptionalDepositLogs {
    // Add fields base on your needs
    // Leave it empty if you don't need any extra logs
    }

struct OptionalWithdrawLogs {
    // Add fields base on your needs
    // Leave it empty if you don't need any extra logs
}
struct(0x11475d67) Deposited {
    initiator: address
    receiver: address
    depositAsset: Cell<Asset>? = null
    depositAmount: coins
    shares: coins
    optionalDepositLogs: OptionalDepositLogs? = null
}

struct (0xedfb416d) Withdrawn {
    initiator: address
    receiver: address
    withdrawAsset: Cell<Asset>? = null
    withdrawAmount: coins
    burnedShares: coins
    optionalWithdrawLogs: OptionalWithdrawLogs? = null
}

struct (0xb7bfa697) Quoted {
    quoteAsset: Cell<Asset>
    initiator: address
    receiver: address
    totalSupply: coins
    totalAssets: coins
    timestamp: Timestamp
}

const TOPIC_DEPOSITED = Deposited.getDeclaredPackPrefix();
const TOPIC_WITHDRAWN = Withdrawn.getDeclaredPackPrefix();
const TOPIC_QUOTED = Quoted.getDeclaredPackPrefix();