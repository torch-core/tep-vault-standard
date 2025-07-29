import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';

describe('TON Vault', () => {
    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>;
    let tonVault: SandboxContract<Vault>;

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, admin, tonVault } = getTestContext());
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and vault are ready to use
    });
});
