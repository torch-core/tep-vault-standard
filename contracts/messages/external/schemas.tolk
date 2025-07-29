import "../../types/asset"

struct(0x11475d67) Deposited {
    initiator: address
    receiver: address
    depositAsset: Cell<Asset>? = null
    depositAmount: coins
    shares: coins
}

struct (0xedfb416d) Withdrawn {
    initiator: address
    receiver: address
    withdrawAsset: Cell<Asset>? = null
    withdrawAmount: coins
    shares: coins
}

const TOPIC_DEPOSITED = Deposited.getDeclaredPackPrefix();
const TOPIC_WITHDRAWN = Withdrawn.getDeclaredPackPrefix();