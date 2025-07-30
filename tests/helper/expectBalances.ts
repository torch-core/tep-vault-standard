import { Blockchain, SandboxContract } from '@ton/sandbox';
import { TreasuryContract } from '@ton/sandbox';
import { JettonWallet, toNano } from '@ton/ton';
import { Vault } from '../../wrappers/Vault';
import { expectVaultSharesAndAssets } from './expectVault';

export const DEPOSIT_GAS = toNano('0.012');

export async function expectTonDepositorBalances(
    depositor: SandboxContract<TreasuryContract>,
    receiverShareWallet: SandboxContract<JettonWallet>,
    receiverShareBalBefore: bigint,
    tonBalBefore: bigint,
    depositAmount: bigint,
    increaseShares: bigint,
) {
    // Expect that depositor ton balance is decreased by depositAmount
    const depositorTonBalanceAfter = await depositor.getBalance();
    expect(depositorTonBalanceAfter).toBeLessThan(tonBalBefore - depositAmount - DEPOSIT_GAS);

    // Expect that receiver share wallet balance is increased by depositAmount
    const receiverShareBalanceAfter = await receiverShareWallet.getBalance();
    expect(receiverShareBalanceAfter).toBe(receiverShareBalBefore + increaseShares);
}

export async function expectTonVaultBalances(
    blockchain: Blockchain,
    vault: SandboxContract<Vault>,
    tonBalBefore: bigint,
    depositAmount: bigint,
    increaseShares: bigint,
    oldTotalAssets: bigint = 0n,
    oldTotalSupply: bigint = 0n,
) {
    // Expect that vault ton balance is increased by depositAmount
    const vaultTonBalanceAfter = (await blockchain.getContract(vault.address)).balance;
    expect(vaultTonBalanceAfter).toBeGreaterThan(tonBalBefore + depositAmount - DEPOSIT_GAS);

    // Expect that vault shares are increased by depositAmount
    await expectVaultSharesAndAssets(vault, depositAmount, increaseShares, oldTotalAssets, oldTotalSupply);
}
