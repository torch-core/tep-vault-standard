import "../../types/asset"

struct OptionalDepositLogs {}

struct OptionalWithdrawLogs {}
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

const TOPIC_DEPOSITED = Deposited.getDeclaredPackPrefix();
const TOPIC_WITHDRAWN = Withdrawn.getDeclaredPackPrefix();