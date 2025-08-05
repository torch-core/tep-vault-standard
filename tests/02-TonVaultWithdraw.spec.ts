import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, Cell, JettonWallet, toNano } from '@ton/ton';
import { expectBurnTxs, expectMintShares, expectWithdrawTONTxs } from './helper/expectTxResults';
import { expectTonVaultBalances, expectVaultSharesAndAssets } from './helper/expectVault';
import {
    buildBurnNotificationPayload,
    buildCallbackFp,
    buildVaultNotification,
    DEFAULT_FAIL_CALLBACK_PAYLOAD,
    DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
} from './helper/callbackPayload';
import { expectWithdrawnEmitLog } from './helper/emitLog';
import { VaultErrors } from '../wrappers/constants/error';
import { Opcodes } from '../wrappers/constants/op';
import { writeFileSync } from 'fs';

describe('Withdraw from TON Vault', () => {
    let blockchain: Blockchain;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalBefore: bigint;
    let maxeyTonBalBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalBefore: bigint;
    let bobTonBalBefore: bigint;
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
        bobShareBalBefore = await bobShareWallet.getBalance();
        bobTonBalBefore = await bob.getBalance();
        // Maxey deposit 5 TON to TON Vault
        const depositAmount = toNano('5');
        const depositArgs = await tonVault.getTonDepositArg({
            queryId,
            depositAmount,
        });
        await maxey.send(depositArgs);

        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        maxeyTonBalBefore = await maxey.getBalance();
        tonVaultTONBalBefore = (await blockchain.getContract(tonVault.address)).balance;
        tonVaultTonBalDelta = 0n;
        const storage = await tonVault.getStorage();
        tonVaultTotalSupplyBefore = storage.totalSupply;
        tonVaultTotalAssetsBefore = storage.totalAssets;
    });

    afterEach(async () => {
        const tonVaultTONBalanceAfter = (await blockchain.getContract(tonVault.address)).balance;
        expect(tonVaultTONBalanceAfter + tonVaultTonBalDelta).toBeGreaterThanOrEqual(tonVaultTONBalBefore);
        tonVaultTonBalDelta = 0n;
    });

    afterAll(() => {
        const coverage = blockchain.coverage(tonVault);
        if (!coverage) return;

        // Generate HTML report for detailed analysis
        const coverageJson = coverage.toJson();
        writeFileSync('./coverage/ton-vault-withdraw.json', coverageJson);
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
        inBody?: Cell,
    ) {
        // Expect withdraw messages is successful
        await expectWithdrawTONTxs(
            withdrawResult,
            initiator.address,
            receiver.address,
            tonVault,
            buildVaultNotification(queryId, 0, initiator.address, callbackPayload, inBody),
        );

        // Expect initiator share balance is decreased burnShares
        const initiatorShareBalAfter = await initiatorShareWallet.getBalance();
        expect(initiatorShareBalAfter).toBe(initiatorShareBalBefore - burnShares);

        // Expect receiver balance is increased expectedWithdrawAmount
        const receiverBalanceAfter = await receiver.getBalance();
        expect(receiverBalanceAfter).toBeGreaterThan(receiverTonBalBefore + expectedWithdrawAmount - WITHDRAW_GAS_FEE);

        await expectTonVaultBalances(
            blockchain,
            tonVault,
            tonVaultTONBalBefore,
            -expectedWithdrawAmount,
            -burnShares,
            tonVaultTotalAssetsBefore,
            tonVaultTotalSupplyBefore,
        );

        // Expect withdraw emit log
        expectWithdrawnEmitLog(withdrawResult, initiator.address, receiver.address, expectedWithdrawAmount, burnShares);
    }

    async function expectWithdrawTONFailure(
        withdrawResult: SendMessageResult,
        initiator: SandboxContract<TreasuryContract>,
        expectedWithdrawAmount: bigint,
        callbackPayload: Cell,
        inBody?: Cell,
        errorCode: number = VaultErrors.FailedMinWithdraw,
    ) {
        await expectBurnTxs(withdrawResult, initiator.address, tonVault, errorCode);

        await expectMintShares(
            withdrawResult,
            tonVault,
            initiator.address,
            buildCallbackFp(queryId, expectedWithdrawAmount, tonVault, errorCode, initiator, callbackPayload, inBody),
        );
    }

    describe('Withdraw TON success', () => {
        afterEach(async () => {
            // Bob's share should be same
            expect(await bobShareWallet.getBalance()).toBe(bobShareBalBefore);
        });

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

            tonVaultTonBalDelta += expectedWithdrawAmount;
        });

        it('should handle withdraw with receiver', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw is successful
            await expectWithdrawTONFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobTonBalBefore,
                burnShares,
                expectedWithdrawAmount,
                DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
            );

            tonVaultTonBalDelta += expectedWithdrawAmount;
        });

        it('should handle withdraw with success callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, {
                callbacks: {
                    successCallback: {
                        includeBody: false,
                        payload: successCallbackPayload,
                    },
                },
            });
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
                successCallbackPayload,
            );

            tonVaultTonBalDelta += expectedWithdrawAmount;
        });

        it('should handle withdraw with success callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawParams = {
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(tonVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

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
                successCallbackPayload,
                inBody,
            );

            tonVaultTonBalDelta += expectedWithdrawAmount;
        });

        it('should handle withdraw to receiver with success callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
                callbacks: {
                    successCallback: {
                        includeBody: false,
                        payload: successCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw is successful
            await expectWithdrawTONFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobTonBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
            );

            tonVaultTonBalDelta += expectedWithdrawAmount;
        });

        it('should handle withdraw to receiver with success callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawParams = {
                receiver: bob.address,
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(tonVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            // Expect withdraw is successful
            await expectWithdrawTONFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobTonBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
                inBody,
            );

            tonVaultTonBalDelta += expectedWithdrawAmount;
        });
    });

    describe('Withdraw TON failure due to minimum withdraw not met', () => {
        afterEach(async () => {
            // Maxey's share should be same
            expect(await maxeyShareWallet.getBalance()).toBe(maxeyShareBalBefore);

            // Bob Ton Balance should be same
            expect(await bob.getBalance()).toBe(bobTonBalBefore);

            // Vault Assets and total supply should be same
            await expectVaultSharesAndAssets(tonVault, 0n, 0n, tonVaultTotalAssetsBefore, tonVaultTotalSupplyBefore);
        });

        it('should handle basic withdraw failure', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, {
                minWithdraw: expectedWithdrawAmount + 1n,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawTONFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                DEFAULT_FAIL_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw failure with receiver', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
                minWithdraw: expectedWithdrawAmount + 1n,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawTONFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                DEFAULT_FAIL_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw failure with failure callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, {
                minWithdraw: expectedWithdrawAmount + 1n,
                callbacks: {
                    failureCallback: {
                        includeBody: false,
                        payload: failCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawTONFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload);
        });

        it('should handle withdraw failure with failure callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
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
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(tonVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            await expectWithdrawTONFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload, inBody);
        });

        it('should handle withdraw failure with receiver and failure callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, {
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

            await expectWithdrawTONFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload);
        });

        it('should handle withdraw failure with receiver and failure callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await tonVault.getPreviewWithdraw(burnShares);
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
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(tonVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            await expectWithdrawTONFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload, inBody);
        });
    });

    describe('Other failure cases', () => {
        it('should throw ERR_INSUFFICIENT_WITHDRAW_GAS when valueCoins < withdraw gas', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: withdrawArgs.to,
                value: toNano('0.012'),
                body: withdrawArgs.body,
            });

            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxeyShareWallet.address,
                to: tonVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.InsufficientWithdrawGas,
            });
        });
        it('should throw INVALID_BURN_AMOUNT when burn shares is 0', async () => {
            const burnShares = 0n;
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect that ton vault share wallet send OP_BURN_NOTIFICATION to vault but throw INVALID_BURN_AMOUNT
            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxeyShareWallet.address,
                to: tonVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.InvalidBurnAmount,
            });
        });

        it('should throw UNAUTHORIZED_BURN when burn shares is not from the vault', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: tonVault.address,
                value: withdrawArgs.value,
                body: buildBurnNotificationPayload(
                    queryId,
                    burnShares,
                    maxey.address,
                    maxey.address,
                    beginCell().store(tonVault.storeVaultWithdrawFp(maxey.address)).endCell(),
                ),
            });

            // Expect that ton vault share wallet send OP_BURN_NOTIFICATION to vault but throw UNAUTHORIZED_BURN
            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxey.address,
                to: tonVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.UnauthorizedBurn,
            });
        });

        it('should throw NULL_CUSTOM_PAYLOAD when custom payload is null', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await tonVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: withdrawArgs.to,
                value: withdrawArgs.value,
                body: beginCell()
                    .store(
                        tonVault.storeJettonBurnMessage({
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
                to: tonVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.MissingCustomPayload,
            });
        });
    });
});
