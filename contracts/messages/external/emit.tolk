import "schemas";

fun emitDeposited(initiator: address, receiver: address, depositAmount: coins, shares: coins) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_DEPOSITED},
        body: Deposited {
            initiator: initiator,
            receiver: receiver,
            depositAmount: depositAmount,
            shares: shares,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}

fun emitWithdrawn(initiator: address, receiver: address, withdrawAmount: coins, shares: coins) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_WITHDRAWN},
        body: Withdrawn {
            initiator: initiator,
            receiver: receiver,
            withdrawAmount: withdrawAmount,
            shares: shares,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}