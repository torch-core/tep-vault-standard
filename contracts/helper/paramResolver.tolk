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

fun resolveWithdrawParams(withdrawParams: VaultWithdrawFp?, initiator: address) {
    if (withdrawParams == null) {
        return VaultWithdrawFp {
            receiver: initiator,
            withdrawAsset: null,
            minWithdraw: 0,
            sucPayload: null,
            failPayload: null,
            optPayload: null,
        };
    }

    return VaultWithdrawFp {
        receiver: withdrawParams.receiver == null ? initiator : withdrawParams.receiver,
        withdrawAsset: withdrawParams.withdrawAsset,
        minWithdraw: withdrawParams.minWithdraw == null ? 0 as coins : withdrawParams.minWithdraw,
        sucPayload: withdrawParams.sucPayload,
        failPayload: withdrawParams.failPayload,
        optPayload: withdrawParams.optPayload,
    };
}