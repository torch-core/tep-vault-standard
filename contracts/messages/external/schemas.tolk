struct(0x11475d67) Deposited {
    initiator: address
    receiver: address
    depositAmount: coins
    shares: coins
}

const TOPIC_DEPOSITED = Deposited.getDeclaredPackPrefix();