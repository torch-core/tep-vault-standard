import "../messages/internal/schemas";

@pure
fun normalizeDepositParams(depositParams: VaultDepositParams?, initiator: address) {
    if (depositParams == null) {
        return VaultDepositParams {
            receiver: initiator,
            minShares: 0,
            operationsParams: OperationParams {},
        };
    }
    
    return VaultDepositParams {
        receiver: depositParams.receiver == null ? initiator : depositParams.receiver,
        minShares: depositParams.minShares == null ? 0 as coins : depositParams.minShares,
        operationsParams: depositParams.operationsParams,
    };
}

@pure
fun normalizeWithdrawParams(withdrawParams: VaultWithdrawFp?, initiator: address) {
    if (withdrawParams == null) {
        return VaultWithdrawFp {
            receiver: initiator,
            withdrawAsset: null,
            minWithdraw: 0,
            payloadParams: OperationParams {},
        };
    }

    return VaultWithdrawFp {
        receiver: withdrawParams.receiver == null ? initiator : withdrawParams.receiver,
        withdrawAsset: withdrawParams.withdrawAsset,
        minWithdraw: withdrawParams.minWithdraw == null ? 0 as coins : withdrawParams.minWithdraw,
        payloadParams: withdrawParams.payloadParams,
    };
}