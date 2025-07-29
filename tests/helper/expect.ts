import { SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault, VaultStorage } from '../../wrappers/Vault';
import { Cell } from '@ton/core';
import { Opcodes } from '../../wrappers/constants/op';
import { VaultErrors } from '../../wrappers/constants/error';
import { buildFailVaultNotification } from './callback';
import { JettonWallet } from '@ton/ton';

export const expectVaultStorage = (storage: VaultStorage, expectedStorage: VaultStorage) => {
    expect(storage.adminAddress.equals(expectedStorage.adminAddress)).toBeTruthy();
    expect(storage.totalSupply).toBe(expectedStorage.totalSupply);
    expect(storage.totalAssets).toBe(expectedStorage.totalAssets);
    expect(storage.jettonWalletCode.equals(expectedStorage.jettonWalletCode)).toBeTruthy();
    expect(storage.content.equals(expectedStorage.content)).toBeTruthy();

    if (expectedStorage.jettonMaster) {
        expect(storage.jettonMaster?.equals(expectedStorage.jettonMaster)).toBeTruthy();
    } else {
        expect(storage.jettonMaster).toBeNull();
    }

    if (expectedStorage.jettonWalletAddress) {
        expect(storage.jettonWalletAddress?.equals(expectedStorage.jettonWalletAddress)).toBeTruthy();
    } else {
        expect(storage.jettonWalletAddress).toBeNull();
    }
};

export async function expectMintShares(
    depositResult: SendMessageResult,
    vault: SandboxContract<Vault>,
    receiver: SandboxContract<TreasuryContract>,
    callbackPayload?: Cell,
) {
    // Expect that vault send OP_INTERNAL_TRANSFER to receiver share jetton wallet
    const receiverShareWalletAddress = await vault.getWalletAddress(receiver.address);
    expect(depositResult.transactions).toHaveTransaction({
        from: vault.address,
        to: receiverShareWalletAddress,
        op: Opcodes.Jetton.InternalTransfer,
        success: true,
    });

    // Expect that receiver share jetton wallet send OP_EXCESSES to receiver
    expect(depositResult.transactions).toHaveTransaction({
        from: receiverShareWalletAddress,
        to: receiver.address,
        op: Opcodes.Jetton.Excesses,
        success: true,
    });

    // Expect that receiver share jetton wallet send OP_TRANSFER_NOTIFICATION to receiver
    if (callbackPayload) {
        expect(depositResult.transactions).toHaveTransaction({
            from: receiverShareWalletAddress,
            to: receiver.address,
            op: Opcodes.Jetton.TransferNotification,
            body: callbackPayload,
        });
    } else {
        expect(depositResult.transactions).toHaveTransaction({
            from: receiverShareWalletAddress,
            to: receiver.address,
            op: Opcodes.Jetton.TransferNotification,
        });
    }
}

export async function expectTONDeposit(
    depositResult: SendMessageResult,
    initiator: SandboxContract<TreasuryContract>,
    receiver: SandboxContract<TreasuryContract>,
    vault: SandboxContract<Vault>,
    callbackPayload?: Cell,
) {
    // Expect that receiver send OP_DEPOSIT to vault
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator.address,
        to: vault.address,
        op: Opcodes.Vault.Deposit,
        success: true,
    });

    await expectMintShares(depositResult, vault, receiver, callbackPayload);
}

export async function expectJettonDeposit(
    depositResult: SendMessageResult,
    initiator: SandboxContract<TreasuryContract>,
    initiatorUSDTJettonWallet: SandboxContract<JettonWallet>,
    vault: SandboxContract<Vault>,
    vaultUSDTJettonWallet: SandboxContract<JettonWallet>,
    callbackPayload?: Cell,
) {
    // Expect that initiator send OP_TRANSFER to initiatorUSDTJettonWallet
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator.address,
        to: initiatorUSDTJettonWallet.address,
        op: Opcodes.Jetton.Transfer,
        success: true,
    });

    // Expect that initiatorUSDTJettonWallet send OP_INTERNAL_TRANSFER to vaultUSDTJettonWallet
    expect(depositResult.transactions).toHaveTransaction({
        from: initiatorUSDTJettonWallet.address,
        to: vaultUSDTJettonWallet.address,
        op: Opcodes.Jetton.InternalTransfer,
        success: true,
    });

    // Expect that vaultUSDTJettonWallet send OP_TRANSFER_NOTIFICATION to Vault
    expect(depositResult.transactions).toHaveTransaction({
        from: vaultUSDTJettonWallet.address,
        to: vault.address,
        op: Opcodes.Jetton.TransferNotification,
        success: true,
    });

    await expectMintShares(depositResult, vault, initiator, callbackPayload);
}

export function expectFailDepositTON(
    depositResult: SendMessageResult,
    initiator: SandboxContract<TreasuryContract>,
    vault: SandboxContract<Vault>,
    queryId: bigint,
    errorCode: number,
    callbackPayload?: Cell,
    inBody?: Cell,
) {
    // Expect that initiator send OP_DEPOSIT to vault and fail with ERR_MIN_SHARES_NOT_MET
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator.address,
        to: vault.address,
        op: Opcodes.Vault.Deposit,
        success: true,
        exitCode: VaultErrors.MinShareNotMet,
    });

    // Expect that Vault send OP_VAULT_NOTIFICATION to initiator
    expect(depositResult.transactions).toHaveTransaction({
        from: vault.address,
        to: initiator.address,
        op: Opcodes.Vault.VaultNotification,
        success: true,
        body: buildFailVaultNotification(queryId, errorCode, initiator.address, callbackPayload, inBody),
    });
}

export async function expectDepositedVaultStorage(
    vault: SandboxContract<Vault>,
    totalAssets: bigint,
    totalSupply: bigint,
) {
    const vaultStorage = await vault.getStorage();
    expect(vaultStorage.totalAssets).toBe(totalAssets);
    expect(vaultStorage.totalSupply).toBe(totalSupply);
}
