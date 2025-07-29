import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonWallet } from '@ton/ton';

describe('Deposit to Jetton Vault', () => {
    let blockchain: Blockchain;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalanceBefore: bigint;
    let maxeyTonBalanceBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalanceBefore: bigint;
    let USDTVault: SandboxContract<Vault>;
    let USDTVaultBalanceBefore: bigint;

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, USDTVault } = getTestContext());
        maxeyShareWallet = blockchain.openContract(
            JettonWallet.create(await USDTVault.getWalletAddress(maxey.address)),
        );
        bobShareWallet = blockchain.openContract(JettonWallet.create(await USDTVault.getWalletAddress(bob.address)));
        maxeyShareBalanceBefore = await maxeyShareWallet.getBalance();
        maxeyTonBalanceBefore = await maxey.getBalance();
        bobShareBalanceBefore = await bobShareWallet.getBalance();
        USDTVaultBalanceBefore = (await blockchain.getContract(USDTVault.address)).balance;
    });

    describe('Deposit success', () => {});
});
