import "schemas";
import "../internal/send"

fun emitDeposited(depositedParams: Deposited) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_DEPOSITED},
        body: depositedParams   
    });
    emitMsg.send(SEND_MODE_REGULAR);
}

fun emitWithdrawn(withdrawnParams: Withdrawn) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_WITHDRAWN},
        body: withdrawnParams
    });
    emitMsg.send(SEND_MODE_REGULAR);
}