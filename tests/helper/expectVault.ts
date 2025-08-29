import { Blockchain, SandboxContract } from '@ton/sandbox';
import { Vault, VaultStorage } from '../../wrappers/Vault';
import { DEPOSIT_GAS } from './expectBalances';
import { JettonWallet } from '@ton/ton';

// =============================================================================
// Storage Validation Helpers
// =============================================================================

export const expectVaultStorage = (storage: VaultStorage, expectedStorage: VaultStorage) => {
    // Basic storage fields
    expect(storage.adminAddress.equals(expectedStorage.adminAddress)).toBeTruthy();
    expect(storage.totalSupply).toBe(expectedStorage.totalSupply);
    expect(storage.totalAssets).toBe(expectedStorage.totalAssets);
    expect(storage.jettonWalletCode.equals(expectedStorage.jettonWalletCode)).toBeTruthy();
    expect(storage.content.equals(expectedStorage.content)).toBeTruthy();

    // Optional jetton master validation
    if (expectedStorage.jettonMaster) {
        expect(storage.jettonMaster?.equals(expectedStorage.jettonMaster)).toBeTruthy();
    } else {
        expect(storage.jettonMaster).toBeNull();
    }

    // Optional jetton wallet address validation
    if (expectedStorage.jettonWalletAddress) {
        expect(storage.jettonWalletAddress?.equals(expectedStorage.jettonWalletAddress)).toBeTruthy();
    } else {
        expect(storage.jettonWalletAddress).toBeNull();
    }

    // Optional extra currency id validation
    if (expectedStorage.extraCurrencyId !== undefined) {
        expect(storage.extraCurrencyId).toBe(expectedStorage.extraCurrencyId);
    } else {
        expect(storage.extraCurrencyId).toBeNull();
    }
};

export async function expectVaultSharesAndAssets(
    vault: SandboxContract<Vault>,
    increaseAssets: bigint,
    increaseSupply: bigint,
    oldTotalAssets: bigint = 0n,
    oldTotalSupply: bigint = 0n,
) {
    const vaultStorage = await vault.getStorage();
    expect(vaultStorage.totalAssets).toBe(increaseAssets + oldTotalAssets);
    expect(vaultStorage.totalSupply).toBe(increaseSupply + oldTotalSupply);
}

export async function expectTonVaultBalances(
    blockchain: Blockchain,
    vault: SandboxContract<Vault>,
    tonBalBefore: bigint,
    assetAmountChange: bigint,
    sharesChange: bigint,
    oldTotalAssets: bigint = 0n,
    oldTotalSupply: bigint = 0n,
) {
    // Expect that vault ton balance is changed by assetAmountChange
    const vaultTonBalanceAfter = (await blockchain.getContract(vault.address)).balance;
    expect(vaultTonBalanceAfter).toBeGreaterThan(tonBalBefore + assetAmountChange - DEPOSIT_GAS);

    // Expect that vault shares and assets are changed by assetAmountChange and sharesChange
    await expectVaultSharesAndAssets(vault, assetAmountChange, sharesChange, oldTotalAssets, oldTotalSupply);
}

export async function expectJettonVaultBalances(
    vault: SandboxContract<Vault>,
    vaultJettonWallet: SandboxContract<JettonWallet>,
    vaultJettonWalletBalBefore: bigint,
    assetAmountChange: bigint,
    sharesChange: bigint,
    oldTotalAssets: bigint = 0n,
    oldTotalSupply: bigint = 0n,
) {
    // Expect that vault jetton wallet balance is increased by assetAmountChange
    expect(await vaultJettonWallet.getBalance()).toBe(vaultJettonWalletBalBefore + assetAmountChange);

    // Expect that vault shares and assets are changed by assetAmountChange and sharesChange
    await expectVaultSharesAndAssets(vault, assetAmountChange, sharesChange, oldTotalAssets, oldTotalSupply);
}

export async function expectEcVaultBalances(
    blockchain: Blockchain,
    vault: SandboxContract<Vault>,
    ecBalBefore: bigint,
    assetAmountChange: bigint,
    sharesChange: bigint,
    oldTotalAssets: bigint = 0n,
    oldTotalSupply: bigint = 0n,
    ecId: number,
) {
    // Expect that vault ec balance is changed by assetAmountChange
    const vaultEcBalanceAfter = (await blockchain.getContract(vault.address)).ec[ecId];
    expect(vaultEcBalanceAfter).toBe(ecBalBefore + assetAmountChange);

    // Expect that vault shares and assets are changed by assetAmountChange and sharesChange
    await expectVaultSharesAndAssets(vault, assetAmountChange, sharesChange, oldTotalAssets, oldTotalSupply);
}
