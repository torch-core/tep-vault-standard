import { Blockchain, printTransactionFees, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonMaster, JettonWallet } from '@ton/ton';
import {
    buildBurnNotificationPayload,
    buildCallbackFp,
    DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
    SUCCESS_RESULT,
} from './helper/callbackPayload';
import { expectWithdrawJettonTxs } from './helper/expectTxResults';
import { beginCell, Cell } from '@ton/core';
import { expectVaultSharesAndAssets } from './helper/expectVault';
import { expectWithdrawnEmitLog } from './helper/emitLog';

describe('Withdraw from Jetton Vault', () => {
    let blockchain: Blockchain;
    let USDT: SandboxContract<JettonMaster>;
    let USDTVault: SandboxContract<Vault>;
    let vaultTotalSupplyBefore: bigint;
    let vaultTotalAssetsBefore: bigint;

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
    let bobUSDTWallet: SandboxContract<JettonWallet>;
    let bobUSDTWalletBalBefore: bigint;
    const queryId = 8n;
    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, USDTVault: USDTVault, USDT } = getTestContext());
        maxeyShareWallet = blockchain.openContract(
            JettonWallet.create(await USDTVault.getWalletAddress(maxey.address)),
        );
        bobShareWallet = blockchain.openContract(JettonWallet.create(await USDTVault.getWalletAddress(bob.address)));

        vaultUSDTWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(USDTVault.address)));

        maxeyUSDTWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(maxey.address)));
        bobUSDTWallet = blockchain.openContract(JettonWallet.create(await USDT.getWalletAddress(bob.address)));

        maxeyUSDTWalletBalBefore = await maxeyUSDTWallet.getBalance();
        bobUSDTWalletBalBefore = await bobUSDTWallet.getBalance();

        // Maxey deposit to USDTVault
        const depositAmount = 10000000n;
        const depositArgs = await USDTVault.getJettonDepositArg(maxey.address, {
            queryId,
            depositAmount,
        });
        await maxey.send(depositArgs);

        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        bobShareBalBefore = await bobShareWallet.getBalance();
        vaultUSDTWalletBalBefore = await vaultUSDTWallet.getBalance();
        maxeyUSDTWalletBalBefore = await maxeyUSDTWallet.getBalance();
        vaultTonBalBefore = (await blockchain.getContract(USDTVault.address)).balance;

        const storage = await USDTVault.getStorage();
        vaultTotalSupplyBefore = storage.totalSupply;
        vaultTotalAssetsBefore = storage.totalAssets;
    });

    afterEach(async () => {
        const vaultTonBalanceAfter = (await blockchain.getContract(USDTVault.address)).balance;
        expect(vaultTonBalanceAfter).toBeGreaterThanOrEqual(vaultTonBalBefore);
    });

    async function expectWithdrawJettonFlows(
        withdrawResult: SendMessageResult,
        initiator: SandboxContract<TreasuryContract>,
        initiatorShareWallet: SandboxContract<JettonWallet>,
        initiatorShareBalBefore: bigint,
        receiver: SandboxContract<TreasuryContract>,
        receiverJettonWallet: SandboxContract<JettonWallet>,
        receiverJettonWalletBalBefore: bigint,
        burnShares: bigint,
        expectedWithdrawAmount: bigint,
        callbackPayload: Cell,
        inBody?: Cell,
    ) {
        await expectWithdrawJettonTxs(
            withdrawResult,
            initiator.address,
            receiver.address,
            receiverJettonWallet.address,
            vaultUSDTWallet.address,
            USDTVault,
            buildCallbackFp(
                queryId,
                expectedWithdrawAmount,
                USDTVault,
                SUCCESS_RESULT,
                initiator,
                callbackPayload,
                inBody,
            ),
            initiator.address,
        );

        // Expect that initiator's share balance is decreased
        expect(await initiatorShareWallet.getBalance()).toBe(initiatorShareBalBefore - burnShares);

        // Expect that receiver's jetton balance is increased
        expect(await receiverJettonWallet.getBalance()).toBe(receiverJettonWalletBalBefore + expectedWithdrawAmount);

        // Expect that vault's jetton balance is decreased
        expect(await vaultUSDTWallet.getBalance()).toBe(vaultUSDTWalletBalBefore - expectedWithdrawAmount);

        // Expect that vault's totalSupply and totalAssets are decreased
        await expectVaultSharesAndAssets(
            USDTVault,
            -expectedWithdrawAmount,
            -burnShares,
            vaultTotalAssetsBefore,
            vaultTotalSupplyBefore,
        );

        // Expect withdraw emit log
        expectWithdrawnEmitLog(withdrawResult, initiator.address, receiver.address, expectedWithdrawAmount, burnShares);
    }

    describe('Withdraw Jetton success', () => {
        it('should handle basic withdraw', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw flows is success
            await expectWithdrawJettonFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                burnShares,
                expectedWithdrawAmount,
                DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw with receiver', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawJettonFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobUSDTWallet,
                bobUSDTWalletBalBefore,
                burnShares,
                expectedWithdrawAmount,
                DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw with success callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, {
                callbacks: {
                    successCallback: {
                        includeBody: false,
                        payload: successCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw flows is success
            await expectWithdrawJettonFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
            );
        });

        it('should handle withdraw with success callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawParams = {
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(USDTVault.storeVaultWithdrawParams(maxey.address, withdrawParams)).endCell(),
            );

            // Expect withdraw flows is success
            await expectWithdrawJettonFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
                inBody,
            );
        });

        it('should handle withdraw with receiver and success callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
                callbacks: {
                    successCallback: {
                        includeBody: false,
                        payload: successCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw flows is success
            await expectWithdrawJettonFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobUSDTWallet,
                bobUSDTWalletBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
            );
        });

        it('should handle withdraw with receiver and success callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawParams = {
                receiver: bob.address,
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(USDTVault.storeVaultWithdrawParams(maxey.address, withdrawParams)).endCell(),
            );

            // Expect withdraw flows is success
            await expectWithdrawJettonFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobUSDTWallet,
                bobUSDTWalletBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
                inBody,
            );
        });
    });
});
