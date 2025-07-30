import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonMaster, JettonWallet } from '@ton/ton';
import { expectJettonDepositTxs } from './helper/expectTxResults';
import { expectDepositedEmitLog } from './helper/emitLog';
import { expectVaultSharesAndAssets } from './helper/expectVault';
import { expectJettonDepositorBalances, expectJettonVaultBalances } from './helper/expectBalances';
import { buildSuccessCallbackFp } from './helper/callbackPayload';
import { Cell } from '@ton/core';

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
    let vaultUSDTWallet: SandboxContract<JettonWallet>;
    let vaultUSDTWalletBalBefore: bigint;
    let vaultTonBalBefore: bigint;

    let maxeyUSDTWallet: SandboxContract<JettonWallet>;
    let maxeyUSDTWalletBalBefore: bigint;

    const queryId = 8n;
    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, USDTVault: USDTVault, USDT } = getTestContext());
        maxeyShareWallet = blockchain.openContract(
            JettonWallet.create(await USDTVault.getWalletAddress(maxey.address)),
        );
        bobShareWallet = blockchain.openContract(JettonWallet.create(await USDTVault.getWalletAddress(bob.address)));
        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        bobShareBalBefore = await bobShareWallet.getBalance();

        vaultTonBalBefore = (await blockchain.getContract(USDTVault.address)).balance;
        vaultUSDTWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(USDTVault.address)));
        vaultUSDTWalletBalBefore = await vaultUSDTWallet.getBalance();

        maxeyUSDTWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(maxey.address)));
        maxeyUSDTWalletBalBefore = await maxeyUSDTWallet.getBalance();
    });

    afterEach(async () => {
        const vaultTonBalanceAfter = (await blockchain.getContract(USDTVault.address)).balance;
        expect(vaultTonBalanceAfter).toBeGreaterThanOrEqual(vaultTonBalBefore);
    });

    async function expectJettonDepositFlows(
        depositResult: SendMessageResult,
        depositor: SandboxContract<TreasuryContract>,
        depositorJettonWallet: SandboxContract<JettonWallet>,
        depositorJettonWalletBalBefore: bigint,
        depositAmount: bigint,
        successCallbackPayload: Cell,
        receiver: SandboxContract<TreasuryContract>,
        receiverShareWallet: SandboxContract<JettonWallet>,
        receiverShareBalBefore: bigint,
        vault: SandboxContract<Vault>,
        vaultJettonWallet: SandboxContract<JettonWallet>,
        vaultJettonWalletBalBefore: bigint,
    ) {
        // Expect that deposit is successful
        await expectJettonDepositTxs(
            depositResult,
            depositor,
            depositorJettonWallet,
            vault,
            vaultJettonWallet,
            successCallbackPayload,
        );

        // Expect depositor balances
        await expectJettonDepositorBalances(
            depositorJettonWallet,
            depositorJettonWalletBalBefore,
            depositAmount,
            receiverShareWallet,
            receiverShareBalBefore,
        );

        // Expect vault balances
        await expectJettonVaultBalances(
            vault,
            vaultJettonWallet,
            vaultJettonWalletBalBefore,
            depositAmount,
            depositAmount,
        );

        // Expect that deposited emit log is emitted
        expectDepositedEmitLog(depositResult, depositor.address, receiver.address, depositAmount, depositAmount);
    }

    describe('Deposit success', () => {
        it('should deposit successfully', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArg);

            // Expect that deposit is successful
            await expectJettonDepositFlows(
                depositResult,
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, USDTVault, maxey),
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });
    });
});
