import "schemas/deposit"
import "schemas/withdraw"
import "schemas/provide-take-quote"

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

fun emitQuoted(quoteParams: Quoted) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_QUOTED},
        body: quoteParams
    });
    emitMsg.send(SEND_MODE_REGULAR);
}