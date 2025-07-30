import { SandboxContract, SendMessageResult, TreasuryContract, Blockchain } from '@ton/sandbox';
import { Vault, VaultStorage } from '../../wrappers/Vault';
import { Cell } from '@ton/core';
import { Opcodes } from '../../wrappers/constants/op';
import { buildFailVaultNotification } from './callbackPayload';
import { JettonWallet } from '@ton/ton';

// =============================================================================
// Share Minting Validation
// =============================================================================

export async function expectMintShares(
    depositResult: SendMessageResult,
    vault: SandboxContract<Vault>,
    receiver: SandboxContract<TreasuryContract>,
    callbackPayload: Cell,
) {
    const receiverShareWalletAddress = await vault.getWalletAddress(receiver.address);

    // Vault sends shares to receiver's jetton wallet
    expect(depositResult.transactions).toHaveTransaction({
        from: vault.address,
        to: receiverShareWalletAddress,
        op: Opcodes.Jetton.InternalTransfer,
        success: true,
    });

    // Share wallet returns excess gas to receiver
    expect(depositResult.transactions).toHaveTransaction({
        from: receiverShareWalletAddress,
        to: receiver.address,
        op: Opcodes.Jetton.Excesses,
        success: true,
    });

    // Share wallet notifies receiver about the transfer
    expect(depositResult.transactions).toHaveTransaction({
        from: receiverShareWalletAddress,
        to: receiver.address,
        op: Opcodes.Jetton.TransferNotification,
        body: callbackPayload,
    });
}

// =============================================================================
// Successful Deposit Validation
// =============================================================================

export async function expectTONDepositTxs(
    depositResult: SendMessageResult,
    initiator: SandboxContract<TreasuryContract>,
    receiver: SandboxContract<TreasuryContract>,
    vault: SandboxContract<Vault>,
    callbackPayload: Cell,
) {
    // Initiator sends TON deposit to vault
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator.address,
        to: vault.address,
        op: Opcodes.Vault.Deposit,
        success: true,
    });

    // Validate share minting process
    await expectMintShares(depositResult, vault, receiver, callbackPayload);
}

export async function expectJettonDepositTxs(
    depositResult: SendMessageResult,
    initiator: SandboxContract<TreasuryContract>,
    initiatorJettonWallet: SandboxContract<JettonWallet>,
    receiver: SandboxContract<TreasuryContract>,
    vault: SandboxContract<Vault>,
    vaultJettonWallet: SandboxContract<JettonWallet>,
    callbackPayload: Cell,
) {
    // Initiator send OP_JETTON_TRANSFER to initiatorJettonWallet
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator.address,
        to: initiatorJettonWallet.address,
        op: Opcodes.Jetton.Transfer,
        success: true,
    });

    // initiatorJettonWallet send OP_JETTON_INTERNAL_TRANSFER to vaultJettonWallet
    expect(depositResult.transactions).toHaveTransaction({
        from: initiatorJettonWallet.address,
        to: vaultJettonWallet.address,
        op: Opcodes.Jetton.InternalTransfer,
        success: true,
    });

    // vaultJettonWallet send OP_EXCESSES to initiator
    expect(depositResult.transactions).toHaveTransaction({
        from: vaultJettonWallet.address,
        to: initiator.address,
        op: Opcodes.Jetton.Excesses,
        success: true,
    });

    // vaultJettonWallet send OP_JETTON_TRANSFER_NOTIFICATION to vault
    expect(depositResult.transactions).toHaveTransaction({
        from: vaultJettonWallet.address,
        to: vault.address,
        op: Opcodes.Jetton.TransferNotification,
        success: true,
    });

    // Validate share minting process
    await expectMintShares(depositResult, vault, receiver, callbackPayload);
}

// =============================================================================
// Failed Deposit Validation
// =============================================================================

export function expectFailDepositTONTxs(
    depositResult: SendMessageResult,
    initiator: SandboxContract<TreasuryContract>,
    vault: SandboxContract<Vault>,
    queryId: bigint,
    exitCode: number,
    callbackPayload?: Cell,
    inBody?: Cell,
) {
    // Deposit transaction fails with specified exit code
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator.address,
        to: vault.address,
        op: Opcodes.Vault.Deposit,
        success: true,
        exitCode: exitCode,
    });

    // Vault sends failure notification back to initiator
    expect(depositResult.transactions).toHaveTransaction({
        from: vault.address,
        to: initiator.address,
        op: Opcodes.Vault.VaultNotification,
        success: true,
        body: buildFailVaultNotification(queryId, exitCode, initiator.address, callbackPayload, inBody),
    });
}
