import { SandboxContract, SendMessageResult, TreasuryContract, Blockchain } from '@ton/sandbox';
import { Vault, VaultStorage } from '../../wrappers/Vault';
import { Address, Cell } from '@ton/core';
import { Opcodes } from '../../wrappers/constants/op';
import { buildVaultNotification } from './callbackPayload';
import { JettonWallet } from '@ton/ton';
import { VaultErrors } from '../../wrappers/constants/error';

// =============================================================================
// Share Minting Validation
// =============================================================================

export async function expectMintShares(
    depositResult: SendMessageResult,
    vault: SandboxContract<Vault>,
    receiver: Address,
    callbackPayload: Cell,
) {
    const receiverShareWalletAddress = await vault.getWalletAddress(receiver);

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
        to: receiver,
        op: Opcodes.Jetton.Excesses,
        success: true,
    });

    // Share wallet notifies receiver about the transfer
    expect(depositResult.transactions).toHaveTransaction({
        from: receiverShareWalletAddress,
        to: receiver,
        op: Opcodes.Jetton.TransferNotification,
        body: callbackPayload,
    });
}

// =============================================================================
// Successful Deposit Validation
// =============================================================================

export async function expectTONDepositTxs(
    depositResult: SendMessageResult,
    initiator: Address,
    receiver: Address,
    vault: SandboxContract<Vault>,
    callbackPayload: Cell,
) {
    // Initiator sends TON deposit to vault
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator,
        to: vault.address,
        op: Opcodes.Vault.Deposit,
        success: true,
    });

    // Validate share minting process
    await expectMintShares(depositResult, vault, receiver, callbackPayload);
}

export async function expectJettonTransferTxs(
    transferResult: SendMessageResult,
    initiator: Address,
    initiatorJettonWallet: Address,
    recieverJettonWallet: Address,
    sendExcessesTo?: Address,
) {
    // Initiator send OP_JETTON_TRANSFER to initiatorJettonWallet
    expect(transferResult.transactions).toHaveTransaction({
        from: initiator,
        to: initiatorJettonWallet,
        op: Opcodes.Jetton.Transfer,
        success: true,
    });

    // initiatorJettonWallet send OP_JETTON_INTERNAL_TRANSFER to recieverJettonWallet
    expect(transferResult.transactions).toHaveTransaction({
        from: initiatorJettonWallet,
        to: recieverJettonWallet,
        op: Opcodes.Jetton.InternalTransfer,
        success: true,
    });

    // recieverJettonWallet send OP_EXCESSES to initiator
    expect(transferResult.transactions).toHaveTransaction({
        from: recieverJettonWallet,
        to: sendExcessesTo ?? initiator,
        op: Opcodes.Jetton.Excesses,
        success: true,
    });
}

export async function expectJettonDepositTxs(
    depositResult: SendMessageResult,
    initiator: Address,
    initiatorJettonWallet: Address,
    receiver: Address,
    vault: SandboxContract<Vault>,
    vaultJettonWallet: Address,
    callbackPayload: Cell,
) {
    await expectJettonTransferTxs(depositResult, initiator, initiatorJettonWallet, vaultJettonWallet);

    // vaultJettonWallet send OP_JETTON_TRANSFER_NOTIFICATION to vault
    expect(depositResult.transactions).toHaveTransaction({
        from: vaultJettonWallet,
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
    initiator: Address,
    vault: SandboxContract<Vault>,
    queryId: bigint,
    exitCode: number,
    callbackPayload?: Cell,
    inBody?: Cell,
) {
    // Deposit transaction fails with specified exit code
    expect(depositResult.transactions).toHaveTransaction({
        from: initiator,
        to: vault.address,
        op: Opcodes.Vault.Deposit,
        success: true,
        exitCode: exitCode,
    });

    // Vault sends failure notification back to initiator
    expect(depositResult.transactions).toHaveTransaction({
        from: vault.address,
        to: initiator,
        op: Opcodes.Vault.VaultNotification,
        success: true,
        body: buildVaultNotification(queryId, exitCode, initiator, callbackPayload, inBody),
    });
}

export async function expectFailDepositJettonTxs(
    depositResult: SendMessageResult,
    initiator: Address,
    initiatorJettonWallet: Address,
    vaultJettonWallet: Address,
    vault: SandboxContract<Vault>,
    callbackPayload: Cell,
    exitCode: number = VaultErrors.MinShareNotMet,
) {
    await expectJettonTransferTxs(depositResult, initiator, initiatorJettonWallet, vaultJettonWallet);

    // vaultJettonWallet send OP_JETTON_TRANSFER_NOTIFICATION to vault
    expect(depositResult.transactions).toHaveTransaction({
        from: vaultJettonWallet,
        to: vault.address,
        op: Opcodes.Jetton.TransferNotification,
        success: true,
        exitCode: exitCode,
    });

    await expectJettonTransferTxs(depositResult, vault.address, vaultJettonWallet, initiatorJettonWallet, initiator);

    // initiatorJettonWallet send OP_JETTON_TRANSFER_NOTIFICATION to initiator
    expect(depositResult.transactions).toHaveTransaction({
        from: initiatorJettonWallet,
        to: initiator,
        op: Opcodes.Jetton.TransferNotification,
        body: callbackPayload,
    });
}

// =============================================================================
// Withdraw Validation
// =============================================================================

export async function expectBurnTxs(
    burnResult: SendMessageResult,
    initiator: Address,
    vault: SandboxContract<Vault>,
    exitCode?: number,
) {
    // Expect burner send OP_BURN to burner share wallet
    const burnerShareWalletAddress = await vault.getWalletAddress(initiator);
    expect(burnResult.transactions).toHaveTransaction({
        from: initiator,
        to: burnerShareWalletAddress,
        op: Opcodes.Jetton.Burn,
        success: true,
    });

    // Expect burner share wallet send OP_BURN_NOTIFICATION to vault
    if (exitCode) {
        expect(burnResult.transactions).toHaveTransaction({
            from: burnerShareWalletAddress,
            to: vault.address,
            op: Opcodes.Jetton.BurnNotification,
            success: true,
            exitCode: exitCode,
        });
    } else {
        expect(burnResult.transactions).toHaveTransaction({
            from: burnerShareWalletAddress,
            to: vault.address,
            op: Opcodes.Jetton.BurnNotification,
            success: true,
        });
    }
}

export async function expectWithdrawTONTxs(
    withdrawResult: SendMessageResult,
    initiator: Address,
    receiver: Address,
    vault: SandboxContract<Vault>,
    callbackPayload: Cell,
) {
    await expectBurnTxs(withdrawResult, initiator, vault);

    // Expect vault send OP_VAULT_NOTIFICATION to burner
    expect(withdrawResult.transactions).toHaveTransaction({
        from: vault.address,
        to: receiver,
        op: Opcodes.Vault.VaultNotification,
        success: true,
        body: callbackPayload,
    });
}
