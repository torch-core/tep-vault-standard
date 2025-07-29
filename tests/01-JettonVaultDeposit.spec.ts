import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonMaster, JettonWallet } from '@ton/ton';
import { Opcodes } from '../wrappers/constants/op';

describe('Deposit to Jetton Vault', () => {
    let blockchain: Blockchain;
    let USDT: SandboxContract<JettonMaster>;
    let USDTVault: SandboxContract<Vault>;

    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalanceBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalanceBefore: bigint;
    let USDTJettonWallet: SandboxContract<JettonWallet>;
    let USDTJettonWalletBalanceBefore: bigint;
    let USDTVaultBalanceBefore: bigint;

    let maxeyUSDTJettonWallet: SandboxContract<JettonWallet>;
    let maxeyUSDTJettonWalletBalanceBefore: bigint;

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, USDTVault, USDT } = getTestContext());
        maxeyShareWallet = blockchain.openContract(
            JettonWallet.create(await USDTVault.getWalletAddress(maxey.address)),
        );
        bobShareWallet = blockchain.openContract(JettonWallet.create(await USDTVault.getWalletAddress(bob.address)));
        maxeyShareBalanceBefore = await maxeyShareWallet.getBalance();
        bobShareBalanceBefore = await bobShareWallet.getBalance();

        USDTVaultBalanceBefore = (await blockchain.getContract(USDTVault.address)).balance;
        USDTJettonWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(USDTVault.address)));
        USDTJettonWalletBalanceBefore = await USDTJettonWallet.getBalance();

        maxeyUSDTJettonWallet = blockchain.openContract(
            JettonWallet.create(await USDT.getWalletAddress(maxey.address)),
        );
        maxeyUSDTJettonWalletBalanceBefore = await maxeyUSDTJettonWallet.getBalance();
    });

    describe('Deposit success', () => {
        it('should deposit successfully', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId: 8n,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArg);

            // Expect that Vault USDT Jetton Wallet send OP_TRANSFER_NOTIFICATION to Vault
            expect(depositResult.transactions).toHaveTransaction({
                from: USDTJettonWallet.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.TransferNotification,
                success: true,
            });

            // Expect that maxey share wallet balance is depositAmount
            expect(await maxeyShareWallet.getBalance()).toBe(maxeyShareBalanceBefore + depositAmount);
        });
    });
});
