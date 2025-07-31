import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonWallet, toNano } from '@ton/ton';

describe('Withdraw from TON Vault', () => {
    let blockchain: Blockchain;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalBefore: bigint;
    let maxeyTonBalBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalBefore: bigint;
    let tonVault: SandboxContract<Vault>;
    let tonVaultTONBalBefore: bigint;
    let tonVaultTonBalDelta: bigint;
    const queryId = 8n;

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, tonVault } = getTestContext());
        maxeyShareWallet = blockchain.openContract(JettonWallet.create(await tonVault.getWalletAddress(maxey.address)));
        bobShareWallet = blockchain.openContract(JettonWallet.create(await tonVault.getWalletAddress(bob.address)));

        // Maxey deposit 5 TON to TON Vault
        const depositAmount = toNano('5');
        const depositArgs = await tonVault.getTonDepositArg({
            queryId,
            depositAmount,
        });
        await maxey.send(depositArgs);

        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        maxeyTonBalBefore = await maxey.getBalance();
        bobShareBalBefore = await bobShareWallet.getBalance();
        tonVaultTONBalBefore = (await blockchain.getContract(tonVault.address)).balance;
        tonVaultTonBalDelta = 0n;
    });

    describe('Withdraw TON success', () => {
        it('should handle basic withdraw', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            console.log('maxeyShareWallet Address', maxeyShareWallet.address);
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send(withdrawArgs);
            printTransactionFees(withdrawResult.transactions);
        });
    });
});
