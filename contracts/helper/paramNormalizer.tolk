import "../messages/internal/schemas";

@pure
fun normalizeDepositParams(depositParams: VaultDepositParams?, initiator: address) {
    if (depositParams == null) {
        return VaultDepositParams {
            receiver: initiator,
            minShares: 0,
            optionalVaultParams: null,
            vaultCallbacks: VaultCallbacks {},
        };
    }
    
    return VaultDepositParams {
        receiver: depositParams.receiver == null ? initiator : depositParams.receiver,
        minShares: depositParams.minShares == null ? 0 as coins : depositParams.minShares,
        optionalVaultParams: depositParams.optionalVaultParams,
        vaultCallbacks: depositParams.vaultCallbacks,
    };
}

@pure
fun normalizeWithdrawParams(withdrawParams: VaultWithdrawFp?, initiator: address) {
    if (withdrawParams == null) {
        return VaultWithdrawFp {
            receiver: initiator,
            minWithdraw: 0,
            optionalVaultParams: null,
            vaultCallbacks: VaultCallbacks {},
        };
    }

    return VaultWithdrawFp {
        receiver: withdrawParams.receiver == null ? initiator : withdrawParams.receiver,
        minWithdraw: withdrawParams.minWithdraw == null ? 0 as coins : withdrawParams.minWithdraw,
        optionalVaultParams: withdrawParams.optionalVaultParams,
        vaultCallbacks: withdrawParams.vaultCallbacks,
    };
}