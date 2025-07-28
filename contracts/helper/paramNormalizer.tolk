import "../messages/internal/schemas";

@pure
fun normalizeDepositParams(depositParams: VaultDepositParams?, initiator: address) {
    if (depositParams == null) {
        return VaultDepositParams {
            receiver: initiator,
            minShares: 0,
            successPayload: null,
            failurePayload: null,
            optionalPayload: null,
        };
    }
    
    return VaultDepositParams {
        receiver: depositParams.receiver == null ? initiator : depositParams.receiver,
        minShares: depositParams.minShares == null ? 0 as coins : depositParams.minShares,
        successPayload: depositParams.successPayload,
        failurePayload: depositParams.failurePayload,
        optionalPayload: depositParams.optionalPayload,
    };
}

@pure
fun normalizeWithdrawParams(withdrawParams: VaultWithdrawFp?, initiator: address) {
    if (withdrawParams == null) {
        return VaultWithdrawFp {
            receiver: initiator,
            withdrawAsset: null,
            minWithdraw: 0,
            successPayload: null,
            failurePayload: null,
            optionalPayload: null,
        };
    }

    return VaultWithdrawFp {
        receiver: withdrawParams.receiver == null ? initiator : withdrawParams.receiver,
        withdrawAsset: withdrawParams.withdrawAsset,
        minWithdraw: withdrawParams.minWithdraw == null ? 0 as coins : withdrawParams.minWithdraw,
        successPayload: withdrawParams.successPayload,
        failurePayload: withdrawParams.failurePayload,
        optionalPayload: withdrawParams.optionalPayload,
    };
}