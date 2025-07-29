import { SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault, VaultStorage } from '../../wrappers/Vault';
import { Cell } from '@ton/core';
import { VaultOpcodes } from '../../wrappers/constants/op';
import { JettonOpcodes } from '../../wrappers/mock-jetton/JettonConstants';
import { VaultErrors } from '../../wrappers/constants/error';
import { buildFailVaultNotification } from './callback';

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
        op: VaultOpcodes.Deposit,
        success: true,
    });

    // Expect that vault send OP_INTERNAL_TRANSFER to receiver share jetton wallet
    const receiverShareWalletAddress = await vault.getWalletAddress(receiver.address);
    expect(depositResult.transactions).toHaveTransaction({
        from: vault.address,
        to: receiverShareWalletAddress,
        op: JettonOpcodes.InternalTransfer,
        success: true,
    });

    // Expect that receiver share jetton wallet send OP_EXCESSES to receiver
    expect(depositResult.transactions).toHaveTransaction({
        from: receiverShareWalletAddress,
        to: receiver.address,
        op: JettonOpcodes.Excesses,
        success: true,
    });

    // Expect that receiver share jetton wallet send OP_TRANSFER_NOTIFICATION to receiver
    if (callbackPayload) {
        expect(depositResult.transactions).toHaveTransaction({
            from: receiverShareWalletAddress,
            to: receiver.address,
            op: JettonOpcodes.TransferNotification,
            body: callbackPayload,
        });
    } else {
        expect(depositResult.transactions).toHaveTransaction({
            from: receiverShareWalletAddress,
            to: receiver.address,
            op: JettonOpcodes.TransferNotification,
        });
    }
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
        op: VaultOpcodes.Deposit,
        success: true,
        exitCode: VaultErrors.MinShareNotMet,
    });

    // Expect that Vault send OP_VAULT_NOTIFICATION to initiator
    expect(depositResult.transactions).toHaveTransaction({
        from: vault.address,
        to: initiator.address,
        op: VaultOpcodes.VaultNotification,
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
