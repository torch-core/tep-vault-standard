import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonMaster, JettonWallet } from '@ton/ton';
import { expectDepositedVaultStorage, expectJettonDeposit } from './helper/expect';

describe('Deposit to Jetton Vault', () => {
    let blockchain: Blockchain;
    let USDT: SandboxContract<JettonMaster>;
    let USDTVault: SandboxContract<Vault>;

    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalBefore: bigint;
    let vaultJettonWallet: SandboxContract<JettonWallet>;
    let vaultJettonWalletBalBefore: bigint;
    let vaultTonBalBefore: bigint;

    let maxeyUSDTWallet: SandboxContract<JettonWallet>;
    let maxeyUSDTWalletBalBefore: bigint;

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, USDTVault: USDTVault, USDT } = getTestContext());
        maxeyShareWallet = blockchain.openContract(JettonWallet.create(await USDTVault.getWalletAddress(maxey.address)));
        bobShareWallet = blockchain.openContract(JettonWallet.create(await USDTVault.getWalletAddress(bob.address)));
        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        bobShareBalBefore = await bobShareWallet.getBalance();

        vaultTonBalBefore = (await blockchain.getContract(USDTVault.address)).balance;
        vaultJettonWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(USDTVault.address)));
        vaultJettonWalletBalBefore = await vaultJettonWallet.getBalance();

        maxeyUSDTWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(maxey.address)));
        maxeyUSDTWalletBalBefore = await maxeyUSDTWallet.getBalance();
    });

    describe('Deposit success', () => {
        it('should deposit successfully', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId: 8n,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArg);

            await expectJettonDeposit(depositResult, maxey, maxeyUSDTWallet, USDTVault, vaultJettonWallet);

            // Expect that maxey share wallet balance is increased by depositAmount
            expect(await maxeyShareWallet.getBalance()).toBe(maxeyShareBalBefore + depositAmount);

            // Expect that maxey USDT wallet balance is decreased by depositAmount
            expect(await maxeyUSDTWallet.getBalance()).toBe(maxeyUSDTWalletBalBefore - depositAmount);

            // Expect that vault jetton wallet balance is increased by depositAmount
            expect(await vaultJettonWallet.getBalance()).toBe(vaultJettonWalletBalBefore + depositAmount);

            await expectDepositedVaultStorage(USDTVault, depositAmount, depositAmount);
        });
    });
});
