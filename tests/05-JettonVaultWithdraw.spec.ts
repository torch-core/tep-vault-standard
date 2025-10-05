import {
    Blockchain,
    BlockchainSnapshot,
    SandboxContract,
    SendMessageResult,
    TreasuryContract,
} from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonWallet } from '@ton/ton';
import {
    buildBurnNotificationPayload,
    buildCallbackFp,
    DEFAULT_FAIL_WITHDRAW_CALLBACK_PAYLOAD,
    DEFAULT_SUCCESS_WITHDRAW_CALLBACK_PAYLOAD,
    SUCCESS_RESULT,
} from './helper/callbackPayload';
import { expectBurnTxs, expectMintShares, expectWithdrawJettonTxs } from './helper/expectTxResults';
import { beginCell, Cell, toNano } from '@ton/core';
import { expectJettonVaultBalances, expectVaultSharesAndAssets } from './helper/expectVault';
import { expectWithdrawnEmitLog } from './helper/emitLog';
import { VaultErrors } from '../wrappers/constants/error';
import { Opcodes } from '../wrappers/constants/op';
import { writeFileSync } from 'fs';
import { MAX_COINS_VALUE } from './helper/constants';
import { JettonMinter } from '../wrappers/mock-jetton/JettonMinter';
import { Asset } from '@torch-finance/core';

describe('Withdraw from Jetton Vault', () => {
    jest.setTimeout(30000);
    let blockchain: Blockchain;
    let USDT: SandboxContract<JettonMinter>;
    let USDTVault: SandboxContract<Vault>;
    let vaultTotalSupplyBefore: bigint;
    let vaultTotalAssetsBefore: bigint;

    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalBefore: bigint;
    let vaultUSDTWallet: SandboxContract<JettonWallet>;
    let vaultUSDTWalletBalBefore: bigint;
    let vaultTonBalBefore: bigint;

    let maxeyUSDTWallet: SandboxContract<JettonWallet>;
    let maxeyUSDTWalletBalBefore: bigint;
    let bobUSDTWallet: SandboxContract<JettonWallet>;
    let bobUSDTWalletBalBefore: bigint;
    let beforeMintUSDTSnapshot: BlockchainSnapshot | null = null;

    const queryId = 8n;
    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, USDTVault: USDTVault, USDT, admin, beforeMintUSDTSnapshot } = getTestContext());
        maxeyShareWallet = blockchain.openContract(
            JettonWallet.create(await USDTVault.getWalletAddress(maxey.address)),
        );

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
        vaultUSDTWalletBalBefore = await vaultUSDTWallet.getBalance();
        maxeyUSDTWalletBalBefore = await maxeyUSDTWallet.getBalance();
        vaultTonBalBefore = (await blockchain.getContract(USDTVault.address)).balance;

        const storage = await USDTVault.getStorage();
        vaultTotalSupplyBefore = storage.totalSupply;
        vaultTotalAssetsBefore = storage.totalAssets;
    });

    afterEach(async () => {
        const vaultTonBalanceAfter = (await blockchain.getContract(USDTVault.address)).balance;
        expect(vaultTonBalanceAfter + 8n).toBeGreaterThanOrEqual(vaultTonBalBefore);
    });

    afterAll(() => {
        const coverage = blockchain.coverage(USDTVault);
        if (!coverage) return;

        // Generate HTML report for detailed analysis
        const coverageJson = coverage.toJson();
        writeFileSync('./coverage/jetton-vault-withdraw.json', coverageJson);
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

        await expectJettonVaultBalances(
            USDTVault,
            vaultUSDTWallet,
            vaultUSDTWalletBalBefore,
            -expectedWithdrawAmount,
            -burnShares,
            vaultTotalAssetsBefore,
            vaultTotalSupplyBefore,
        );

        // Expect withdraw emit log
        expectWithdrawnEmitLog(withdrawResult, initiator.address, receiver.address, expectedWithdrawAmount, burnShares, vaultTotalSupplyBefore, vaultTotalAssetsBefore, Asset.jetton(USDT.address));
    }

    async function expectWithdrawJettonFailure(
        withdrawResult: SendMessageResult,
        initiator: SandboxContract<TreasuryContract>,
        expectedWithdrawAmount: bigint,
        callbackPayload: Cell,
        inBody?: Cell,
        errorCode: number = VaultErrors.FailedMinWithdraw,
    ) {
        await expectBurnTxs(withdrawResult, initiator.address, USDTVault, errorCode);

        await expectMintShares(
            withdrawResult,
            USDTVault,
            initiator.address,
            buildCallbackFp(queryId, expectedWithdrawAmount, USDTVault, errorCode, initiator, callbackPayload, inBody),
        );
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
                DEFAULT_SUCCESS_WITHDRAW_CALLBACK_PAYLOAD,
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
                DEFAULT_SUCCESS_WITHDRAW_CALLBACK_PAYLOAD,
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
                beginCell().store(USDTVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
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
                beginCell().store(USDTVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
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

        it('should handle withdraw with max amount', async () => {
            // Reset blockchain before miting any USDT
            await blockchain.loadFrom(beforeMintUSDTSnapshot!);

            // Mint max amount of USDT to maxey
            await USDT.sendMint(admin.getSender(), maxey.address, MAX_COINS_VALUE);

            // Deposit max amount
            const depositAmount = MAX_COINS_VALUE;
            const depositArgs = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
            });
            await maxey.send(depositArgs);
            const maxeyShareBalBefore = await maxeyShareWallet.getBalance();

            // Update balances before
            maxeyUSDTWalletBalBefore = await maxeyUSDTWallet.getBalance();
            vaultUSDTWalletBalBefore = await vaultUSDTWallet.getBalance();
            const storage = await USDTVault.getStorage();
            vaultTotalSupplyBefore = storage.totalSupply;
            vaultTotalAssetsBefore = storage.totalAssets;

            // Withdraw max amount
            const burnShares = maxeyShareBalBefore;
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
                DEFAULT_SUCCESS_WITHDRAW_CALLBACK_PAYLOAD,
            );
        });
    });

    describe('Withdraw Jetton failure due to minimum withdraw not met', () => {
        afterEach(async () => {
            // Maxey's share should be same
            expect(await maxeyShareWallet.getBalance()).toBe(maxeyShareBalBefore);

            // Maxey's jetton balance should be same
            expect(await maxeyUSDTWallet.getBalance()).toBe(maxeyUSDTWalletBalBefore);

            // Bob Jetton Balance should be same
            expect(await bobUSDTWallet.getBalance()).toBe(bobUSDTWalletBalBefore);

            // Vault Assets and total supply should be same
            await expectVaultSharesAndAssets(USDTVault, 0n, 0n, vaultTotalAssetsBefore, vaultTotalSupplyBefore);
        });

        it('should handle basic withdraw failure', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, {
                minWithdraw: expectedWithdrawAmount + 1n,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawJettonFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                DEFAULT_FAIL_WITHDRAW_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw failure with receiver', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
                minWithdraw: expectedWithdrawAmount + 1n,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawJettonFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                DEFAULT_FAIL_WITHDRAW_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw failure with failure callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, {
                minWithdraw: expectedWithdrawAmount + 1n,
                callbacks: {
                    failureCallback: {
                        includeBody: false,
                        payload: failCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawJettonFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload);
        });

        it('should handle withdraw failure with failure callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawParams = {
                minWithdraw: expectedWithdrawAmount + 1n,
                callbacks: {
                    failureCallback: {
                        includeBody: true,
                        payload: failCallbackPayload,
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
                beginCell().store(USDTVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            await expectWithdrawJettonFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                failCallbackPayload,
                inBody,
            );
        });

        it('should handle withdraw failure with receiver and failure callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
                minWithdraw: expectedWithdrawAmount + 1n,
                callbacks: {
                    failureCallback: {
                        includeBody: false,
                        payload: failCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawJettonFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload);
        });

        it('should handle withdraw failure with receiver and failure callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await USDTVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawParams = {
                receiver: bob.address,
                minWithdraw: expectedWithdrawAmount + 1n,
                callbacks: {
                    failureCallback: {
                        includeBody: true,
                        payload: failCallbackPayload,
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
                beginCell().store(USDTVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            await expectWithdrawJettonFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                failCallbackPayload,
                inBody,
            );
        });
    });

    describe('Other failure cases', () => {
        it('should throw ERR_INSUFFICIENT_WITHDRAW_GAS when valueCoins < withdraw gas', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: withdrawArgs.to,
                value: toNano('0.012'),
                body: withdrawArgs.body,
            });

            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxeyShareWallet.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.InsufficientWithdrawGas,
            });
        });
        it('should throw INVALID_BURN_AMOUNT when burn shares is 0', async () => {
            const burnShares = 0n;
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect that USDTVault share wallet send OP_BURN_NOTIFICATION to vault but throw INVALID_BURN_AMOUNT
            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxeyShareWallet.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.InvalidBurnAmount,
            });
        });

        it('should throw UNAUTHORIZED_BURN when burn shares is not from the vault', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: USDTVault.address,
                value: withdrawArgs.value,
                body: buildBurnNotificationPayload(
                    queryId,
                    burnShares,
                    maxey.address,
                    maxey.address,
                    beginCell().store(USDTVault.storeVaultWithdrawFp(maxey.address)).endCell(),
                ),
            });

            // Expect that USDTVault share wallet send OP_BURN_NOTIFICATION to vault but throw UNAUTHORIZED_BURN
            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxey.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.UnauthorizedBurn,
            });
        });

        it('should throw NULL_CUSTOM_PAYLOAD when custom payload is null', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await USDTVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: withdrawArgs.to,
                value: withdrawArgs.value,
                body: beginCell()
                    .store(
                        USDTVault.storeJettonBurnMessage({
                            queryId: queryId ?? 8n,
                            amount: burnShares,
                            responseDst: maxey.address,
                        }),
                    )
                    .endCell(),
            });

            // Expect that ton vault share wallet send OP_BURN_NOTIFICATION to vault but throw NULL_CUSTOM_PAYLOAD
            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxeyShareWallet.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.MissingCustomPayload,
            });
        });
    });
});
