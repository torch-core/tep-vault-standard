import { SandboxContract } from '@ton/sandbox';
import { Vault, VaultStorage } from '../../wrappers/Vault';

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
};

export async function expectVaultSharesAndAssets(
    vault: SandboxContract<Vault>,
    totalAssets: bigint,
    totalSupply: bigint,
) {
    const vaultStorage = await vault.getStorage();
    expect(vaultStorage.totalAssets).toBe(totalAssets);
    expect(vaultStorage.totalSupply).toBe(totalSupply);
}
