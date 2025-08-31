import { Blockchain, SandboxContract } from '@ton/sandbox';
import { TreasuryContract } from '@ton/sandbox';
import { JettonWallet, toNano } from '@ton/ton';

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

export async function expectJettonDepositorBalances(
    depositorJettonWallet: SandboxContract<JettonWallet>,
    depositorJettonWalletBalBefore: bigint,
    depositAmount: bigint,
    receiverShareWallet: SandboxContract<JettonWallet>,
    receiverShareWalletBalBefore: bigint,
) {
    // Expect that depositor Jetton wallet balance is decreased by depositAmount
    expect(await depositorJettonWallet.getBalance()).toBe(depositorJettonWalletBalBefore - depositAmount);

    // Expect that receiver shares wallet balance is increased by depositAmount
    expect(await receiverShareWallet.getBalance()).toBe(receiverShareWalletBalBefore + depositAmount);
}

export async function expectEcDepositorBalances(
    blockchain: Blockchain,
    depositor: SandboxContract<TreasuryContract>,
    receiverShareWallet: SandboxContract<JettonWallet>,
    receiverShareBalBefore: bigint,
    ecBalBefore: bigint,
    depositAmount: bigint,
    increaseShares: bigint,
    ecId: number,
) {
    // Expect that depositor ec balance is decreased by depositAmount
    const depositorEcBalanceAfter = (await blockchain.getContract(depositor.address)).ec[ecId];
    expect(depositorEcBalanceAfter).toBe(ecBalBefore - depositAmount);

    // Expect that receiver share wallet balance is increased by depositAmount
    const receiverShareBalanceAfter = await receiverShareWallet.getBalance();
    expect(receiverShareBalanceAfter).toBe(receiverShareBalBefore + increaseShares);
}
