import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { Cell, JettonWallet, toNano } from '@ton/ton';
import { expectWithdrawTONTxs } from './helper/expectTxResults';
import { expectVaultSharesAndAssets } from './helper/expectVault';
import { buildVaultNotification, DEFAULT_SUCCESS_CALLBACK_PAYLOAD } from './helper/callbackPayload';

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
    let tonVaultTotalSupplyBefore: bigint;
    let tonVaultTotalAssetsBefore: bigint;
    const queryId = 8n;
    const WITHDRAW_GAS_FEE = toNano('0.25');

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
        const storage = await tonVault.getStorage();
        tonVaultTotalSupplyBefore = storage.totalSupply;
        tonVaultTotalAssetsBefore = storage.totalAssets;
    });

    async function expectWithdrawTONFlows(
        withdrawResult: SendMessageResult,
        initiator: SandboxContract<TreasuryContract>,
        initiatorShareWallet: SandboxContract<JettonWallet>,
        initiatorShareBalBefore: bigint,
        receiver: SandboxContract<TreasuryContract>,
        receiverTonBalBefore: bigint,
        burnShares: bigint,
        expectedWithdrawAmount: bigint,
        callbackPayload: Cell,
    ) {
        // Expect withdraw messages is successful
        await expectWithdrawTONTxs(
            withdrawResult,
            initiator,
            receiver,
            tonVault,
            buildVaultNotification(queryId, 0, initiator.address, callbackPayload),
        );

        // Expect initiator share balance is decreased burnShares
        const initiatorShareBalAfter = await initiatorShareWallet.getBalance();
        expect(initiatorShareBalAfter).toBe(initiatorShareBalBefore - burnShares);

        // Expect receiver balance is increased expectedWithdrawAmount
        const receiverBalanceAfter = await receiver.getBalance();
        expect(receiverBalanceAfter).toBeGreaterThan(receiverTonBalBefore + expectedWithdrawAmount - WITHDRAW_GAS_FEE);

        await expectVaultSharesAndAssets(
            tonVault,
            -expectedWithdrawAmount,
            -burnShares,
            tonVaultTotalAssetsBefore,
            tonVaultTotalSupplyBefore,
        );
    }

    describe('Withdraw TON success', () => {
        it('should handle basic withdraw', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw is successful
            await expectWithdrawTONFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxey,
                maxeyTonBalBefore,
                burnShares,
                expectedWithdrawAmount,
                DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
            );
        });
    });
});
