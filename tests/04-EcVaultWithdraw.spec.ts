import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, Cell, JettonWallet, toNano } from '@ton/ton';
import { expectBurnTxs, expectMintShares, expectWithdrawEcTxs } from './helper/expectTxResults';
import { expectEcVaultBalances, expectVaultSharesAndAssets } from './helper/expectVault';
import {
    buildBurnNotificationPayload,
    buildCallbackFp,
    buildVaultNotificationEc,
    DEFAULT_FAIL_CALLBACK_PAYLOAD,
    DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
} from './helper/callbackPayload';
import { expectWithdrawnEmitLog } from './helper/emitLog';
import { VaultErrors } from '../wrappers/constants/error';
import { Opcodes } from '../wrappers/constants/op';
import { writeFileSync } from 'fs';

describe('Withdraw from Extra Currency Vault', () => {
    let blockchain: Blockchain;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalBefore: bigint;
    let maxeyEcBalBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalBefore: bigint;
    let bobEcBalBefore: bigint;
    let ecVault: SandboxContract<Vault>;
    let ecVaultEcBalBefore: bigint;
    let ecVaultEcBalDelta: bigint;
    let ecVaultTonBalBefore: bigint;
    let ecVaultTotalSupplyBefore: bigint;
    let ecVaultTotalAssetsBefore: bigint;
    let ecId: number;
    const queryId = 8n;
    const WITHDRAW_GAS_FEE = toNano('0.25');

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, ecVault, ecId } = getTestContext());
        maxeyShareWallet = blockchain.openContract(JettonWallet.create(await ecVault.getWalletAddress(maxey.address)));
        bobShareWallet = blockchain.openContract(JettonWallet.create(await ecVault.getWalletAddress(bob.address)));
        bobShareBalBefore = await bobShareWallet.getBalance();
        bobEcBalBefore = (await blockchain.getContract(bob.address)).ec[ecId];
        // Maxey deposit 5 TON to ecVault
        const depositAmount = 10000000n;
        const depositArgs = await ecVault.getEcDepositArg({
            queryId,
            depositAmount,
        });
        await maxey.send(depositArgs);

        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        maxeyEcBalBefore = (await blockchain.getContract(maxey.address)).ec[ecId];
        ecVaultEcBalBefore = (await blockchain.getContract(ecVault.address)).ec[ecId];
        ecVaultEcBalDelta = 0n;
        ecVaultTonBalBefore = (await blockchain.getContract(ecVault.address)).balance;
        const storage = await ecVault.getStorage();
        ecVaultTotalSupplyBefore = storage.totalSupply;
        ecVaultTotalAssetsBefore = storage.totalAssets;
    });

    afterEach(async () => {
        const ecVaultBalanceAfter = (await blockchain.getContract(ecVault.address)).balance;
        expect(ecVaultBalanceAfter + 5n).toBeGreaterThanOrEqual(ecVaultTonBalBefore);
    });

    afterAll(() => {
        const coverage = blockchain.coverage(ecVault);
        if (!coverage) return;

        // Generate HTML report for detailed analysis
        const coverageJson = coverage.toJson();
        writeFileSync('./coverage/ton-vault-withdraw.json', coverageJson);
    });

    async function expectWithdrawEcFlows(
        withdrawResult: SendMessageResult,
        initiator: SandboxContract<TreasuryContract>,
        initiatorShareWallet: SandboxContract<JettonWallet>,
        initiatorShareBalBefore: bigint,
        receiver: SandboxContract<TreasuryContract>,
        receiverEcBalBefore: bigint,
        burnShares: bigint,
        expectedWithdrawAmount: bigint,
        callbackPayload: Cell,
        inBody?: Cell,
    ) {
        // Expect withdraw messages is successful
        await expectWithdrawEcTxs(
            withdrawResult,
            initiator.address,
            receiver.address,
            ecVault,
            buildVaultNotificationEc(queryId, 0, initiator.address, callbackPayload, inBody),
        );

        // Expect initiator share balance is decreased burnShares
        const initiatorShareBalAfter = await initiatorShareWallet.getBalance();
        expect(initiatorShareBalAfter).toBe(initiatorShareBalBefore - burnShares);

        // Expect receiver balance is increased expectedWithdrawAmount
        const receiverEcBalanceAfter = (await blockchain.getContract(receiver.address)).ec[ecId];
        expect(receiverEcBalanceAfter).toBe(receiverEcBalBefore + expectedWithdrawAmount);

        await expectEcVaultBalances(
            blockchain,
            ecVault,
            ecVaultEcBalBefore,
            -expectedWithdrawAmount,
            -burnShares,
            ecVaultTotalAssetsBefore,
            ecVaultTotalSupplyBefore,
            ecId,
        );

        // Expect withdraw emit log
        expectWithdrawnEmitLog(withdrawResult, initiator.address, receiver.address, expectedWithdrawAmount, burnShares);
    }

    async function expectWithdrawEcFailure(
        withdrawResult: SendMessageResult,
        initiator: SandboxContract<TreasuryContract>,
        expectedWithdrawAmount: bigint,
        callbackPayload: Cell,
        inBody?: Cell,
        errorCode: number = VaultErrors.FailedMinWithdraw,
    ) {
        await expectBurnTxs(withdrawResult, initiator.address, ecVault, errorCode);

        await expectMintShares(
            withdrawResult,
            ecVault,
            initiator.address,
            buildCallbackFp(queryId, expectedWithdrawAmount, ecVault, errorCode, initiator, callbackPayload, inBody),
        );
    }

    describe('Withdraw Extra Currency success', () => {
        afterEach(async () => {
            // Bob's share should be same
            expect(await bobShareWallet.getBalance()).toBe(bobShareBalBefore);
        });

        it('should handle basic withdraw', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw is successful
            await expectWithdrawEcFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxey,
                maxeyEcBalBefore,
                burnShares,
                expectedWithdrawAmount,
                DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw with receiver', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw is successful
            await expectWithdrawEcFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobEcBalBefore,
                burnShares,
                expectedWithdrawAmount,
                DEFAULT_SUCCESS_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw with success callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, {
                callbacks: {
                    successCallback: {
                        includeBody: false,
                        payload: successCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect withdraw is successful
            await expectWithdrawEcFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxey,
                maxeyEcBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
            );
        });

        it('should handle withdraw with success callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawParams = {
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(ecVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            // Expect withdraw is successful
            await expectWithdrawEcFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxey,
                maxeyEcBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
                inBody,
            );
        });

        it('should handle withdraw to receiver with success callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, {
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
            await expectWithdrawEcFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobEcBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
            );
        });

        it('should handle withdraw to receiver with success callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawParams = {
                receiver: bob.address,
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(ecVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            // Expect withdraw is successful
            await expectWithdrawEcFlows(
                withdrawResult,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                bob,
                bobEcBalBefore,
                burnShares,
                expectedWithdrawAmount,
                successCallbackPayload,
                inBody,
            );
        });
    });

    describe('Withdraw Extra Currency failure due to minimum withdraw not met', () => {
        afterEach(async () => {
            // Maxey's share should be same
            expect(await maxeyShareWallet.getBalance()).toBe(maxeyShareBalBefore);

            // Bob Ec Balance should be same
            expect((await blockchain.getContract(bob.address)).ec[ecId]).toBe(bobEcBalBefore);

            // Vault Assets and total supply should be same
            await expectVaultSharesAndAssets(ecVault, 0n, 0n, ecVaultTotalAssetsBefore, ecVaultTotalSupplyBefore);
        });

        it('should handle basic withdraw failure', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, {
                minWithdraw: expectedWithdrawAmount + 1n,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawEcFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                DEFAULT_FAIL_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw failure with receiver', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, {
                receiver: bob.address,
                minWithdraw: expectedWithdrawAmount + 1n,
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawEcFailure(
                withdrawResult,
                maxey,
                expectedWithdrawAmount,
                DEFAULT_FAIL_CALLBACK_PAYLOAD,
            );
        });

        it('should handle withdraw failure with failure callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, {
                minWithdraw: expectedWithdrawAmount + 1n,
                callbacks: {
                    failureCallback: {
                        includeBody: false,
                        payload: failCallbackPayload,
                    },
                },
            });
            const withdrawResult = await maxey.send(withdrawArgs);

            await expectWithdrawEcFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload);
        });

        it('should handle withdraw failure with failure callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
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
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(ecVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            await expectWithdrawEcFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload, inBody);
        });

        it('should handle withdraw failure with receiver and failure callback (body not included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, {
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

            await expectWithdrawEcFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload);
        });

        it('should handle withdraw failure with receiver and failure callback (body included)', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const expectedWithdrawAmount = await ecVault.getPreviewWithdraw(burnShares);
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
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares, withdrawParams);
            const withdrawResult = await maxey.send(withdrawArgs);

            const inBody = buildBurnNotificationPayload(
                queryId,
                burnShares,
                maxey.address,
                maxey.address,
                beginCell().store(ecVault.storeVaultWithdrawFp(maxey.address, withdrawParams)).endCell(),
            );

            await expectWithdrawEcFailure(withdrawResult, maxey, expectedWithdrawAmount, failCallbackPayload, inBody);
        });
    });

    describe('Other failure cases', () => {
        it('should throw ERR_INSUFFICIENT_WITHDRAW_GAS when valueCoins < withdraw gas', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: withdrawArgs.to,
                value: toNano('0.012'),
                body: withdrawArgs.body,
            });

            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxeyShareWallet.address,
                to: ecVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.InsufficientWithdrawGas,
            });
        });
        it('should throw INVALID_BURN_AMOUNT when burn shares is 0', async () => {
            const burnShares = 0n;
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send(withdrawArgs);

            // Expect that ton vault share wallet send OP_BURN_NOTIFICATION to vault but throw INVALID_BURN_AMOUNT
            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxeyShareWallet.address,
                to: ecVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.InvalidBurnAmount,
            });
        });

        it('should throw UNAUTHORIZED_BURN when burn shares is not from the vault', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: ecVault.address,
                value: withdrawArgs.value,
                body: buildBurnNotificationPayload(
                    queryId,
                    burnShares,
                    maxey.address,
                    maxey.address,
                    beginCell().store(ecVault.storeVaultWithdrawFp(maxey.address)).endCell(),
                ),
            });

            // Expect that ton vault share wallet send OP_BURN_NOTIFICATION to vault but throw UNAUTHORIZED_BURN
            expect(withdrawResult.transactions).toHaveTransaction({
                from: maxey.address,
                to: ecVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.UnauthorizedBurn,
            });
        });

        it('should throw NULL_CUSTOM_PAYLOAD when custom payload is null', async () => {
            const burnShares = maxeyShareBalBefore / 2n;
            const withdrawArgs = await ecVault.getWithdrawArg(maxey.address, burnShares);
            const withdrawResult = await maxey.send({
                to: withdrawArgs.to,
                value: withdrawArgs.value,
                body: beginCell()
                    .store(
                        ecVault.storeJettonBurnMessage({
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
                to: ecVault.address,
                op: Opcodes.Jetton.BurnNotification,
                success: false,
                exitCode: VaultErrors.MissingCustomPayload,
            });
        });
    });
});
