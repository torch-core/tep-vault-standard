import "../messages/internal/schemas";

fun resolveDepositParams(depositParams: VaultDepositParams?, initiator: address) {
    if (depositParams == null) {
        return VaultDepositParams {
            receiver: initiator,
            minMint: 0,
            sucPayload: null,
            failPayload: null,
            optPayload: null,
        };
    }
    
    return VaultDepositParams {
        receiver: depositParams.receiver == null ? initiator : depositParams.receiver,
        minMint: depositParams.minMint == null ? 0 as coins : depositParams.minMint,
        sucPayload: depositParams.sucPayload,
        failPayload: depositParams.failPayload,
        optPayload: depositParams.optPayload,
    };
}