import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { toNano } from '@ton/core';

describe('Deposit to TON Vault', () => {
    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>;
    let maxey: SandboxContract<TreasuryContract>;
    let tonVault: SandboxContract<Vault>;

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, admin, maxey, tonVault } = getTestContext());
    });

    it('should deposit TON to TON Vault', async () => {
        const depositAmount = toNano('5');
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), {
            queryId: 8n,
            depositAmount,
        });

        printTransactionFees(depositResult.transactions);
    });
});
