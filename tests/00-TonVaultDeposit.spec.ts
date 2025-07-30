import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, Cell, toNano } from '@ton/core';
import { JettonWallet } from '../wrappers/mock-jetton/JettonWallet';
import { buildSuccessCallbackFp } from './helper/callback';
import { expectVaultSharesAndAssets, expectFailDepositTON, expectTONDepositTxs } from './helper/expect';
import { VaultErrors } from '../wrappers/constants/error';
import { expectDepositedEmitLog } from './helper/emit';

describe('Deposit to TON Vault', () => {
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
    const queryId = 8n;
    const DEPOSIT_GAS = toNano('0.012');
    const DEPOSIT_FAIL_GAS = toNano('0.015');

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, tonVault } = getTestContext());
        maxeyShareWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await tonVault.getWalletAddress(maxey.address)),
        );
        bobShareWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await tonVault.getWalletAddress(bob.address)),
        );
        maxeyShareBalBefore = await maxeyShareWallet.getJettonBalance();
        maxeyTonBalBefore = await maxey.getBalance();
        bobShareBalBefore = await bobShareWallet.getJettonBalance();
        tonVaultTONBalBefore = (await blockchain.getContract(tonVault.address)).balance;
        tonVaultTonBalDelta = 0n;
    });

    afterEach(async () => {
        const tonVaultTONBalanceAfter = (await blockchain.getContract(tonVault.address)).balance;
        expect(tonVaultTONBalanceAfter - tonVaultTonBalDelta).toBeGreaterThanOrEqual(tonVaultTONBalBefore);
    });

    async function expectTonDepositorBalances(
        depositor: SandboxContract<TreasuryContract>,
        shareWallet: SandboxContract<JettonWallet>,
        shareBalBefore: bigint,
        tonBalBefore: bigint,
        depositAmount: bigint,
        increaseShares: bigint,
    ) {
        // Expect that depositor ton balance is decreased by depositAmount
        const depositorTonBalanceAfter = await depositor.getBalance();
        expect(depositorTonBalanceAfter).toBeLessThan(tonBalBefore - depositAmount - DEPOSIT_GAS);

        // Expect that share wallet balance is increased by depositAmount
        const shareBalanceAfter = await shareWallet.getJettonBalance();
        expect(shareBalanceAfter).toBe(shareBalBefore + increaseShares);
    }

    async function expectTonVaultBalances(
        vault: SandboxContract<Vault>,
        tonBalBefore: bigint,
        depositAmount: bigint,
        increaseShares: bigint,
    ) {
        // Expect that vault ton balance is increased by depositAmount
        const vaultTonBalanceAfter = (await blockchain.getContract(vault.address)).balance;
        expect(vaultTonBalanceAfter).toBeGreaterThan(tonBalBefore + depositAmount - DEPOSIT_GAS);

        // Expect that vault shares are increased by depositAmount
        await expectVaultSharesAndAssets(vault, depositAmount, increaseShares);
    }

    async function expectTonDepositFlows(
        depositResult: SendMessageResult,
        depositor: SandboxContract<TreasuryContract>,
        receiver: SandboxContract<TreasuryContract>,
        depositorShareWallet: SandboxContract<JettonWallet>,
        depositorShareBalBefore: bigint,
        depositorTonBalBefore: bigint,
        depositAmount: bigint,
        successCallbackPayload?: Cell,
    ) {
        // Expect the deposit to be successful
        await expectTONDepositTxs(depositResult, depositor, receiver, tonVault, successCallbackPayload);

        // Expect that depositor shares and ton balances are updated
        await expectTonDepositorBalances(
            depositor,
            depositorShareWallet,
            depositorShareBalBefore,
            depositorTonBalBefore,
            depositAmount,
            depositAmount,
        );

        // Expect that tonVault balance is increased by depositAmount and shares/assets are increased by depositAmount
        await expectTonVaultBalances(tonVault, tonVaultTONBalBefore, depositAmount, depositAmount);

        // Expect that deposited emit log is emitted
        expectDepositedEmitLog(depositResult, depositor.address, receiver.address, depositAmount, depositAmount);

        // Update tonVaultTonBalDelta
        tonVaultTonBalDelta = depositAmount;
    }

    async function expectTonDepositFailureFlows(
        depositResult: SendMessageResult,
        depositor: SandboxContract<TreasuryContract>,
        vault: SandboxContract<Vault>,
        queryId: bigint,
        exitCode: number,
        depositorTonBalBefore: bigint,
        failCallbackPayload?: Cell,
        inBody?: Cell,
    ) {
        expectFailDepositTON(depositResult, depositor, vault, queryId, exitCode, failCallbackPayload, inBody);

        // Expect that depositor ton balance is only decreased by gas fee
        const depositorTonBalanceAfter = await depositor.getBalance();
        expect(depositorTonBalanceAfter).toBeGreaterThan(depositorTonBalBefore - DEPOSIT_FAIL_GAS);

        // Expect that tonVault shares and total assets are not updated
        await expectVaultSharesAndAssets(vault, 0n, 0n);
    }

    describe('Deposit success', () => {
        it('should handle basic deposit to depositor', async () => {
            // Maxey deposit 5 TON to TON Vault
            const depositAmount = toNano('5');
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect the deposit to be successful
            await expectTonDepositFlows(
                depositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyTonBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey),
            );
        });

        it('should handle deposit to specified receiver', async () => {
            // Maxey deposit 5 TON to TON Vault with receiver bob
            const depositAmount = toNano('5');
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    receiver: bob.address,
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect the deposit to be successful
            await expectTONDepositTxs(
                depositResult,
                maxey,
                bob,
                tonVault,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey),
            );
        });

        it('should handle deposit with success callback (body not included)', async () => {
            // Maxey deposit 5 TON to TON Vault with success callback and without body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    callbacks: {
                        successCallback: {
                            includeBody: false,
                            payload: successCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect the deposit to be successful
            await expectTonDepositFlows(
                depositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyTonBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey, successCallbackPayload),
            );
        });

        it('should handle deposit with success callback (body included)', async () => {
            // Maxey deposit 5 TON to TON Vault with success callback and with body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    callbacks: {
                        successCallback: {
                            includeBody: true,
                            payload: successCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect the deposit to be successful with success callback and in body
            await expectTonDepositFlows(
                depositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyTonBalBefore,
                depositAmount,
                buildSuccessCallbackFp(
                    queryId,
                    depositAmount,
                    tonVault,
                    maxey,
                    successCallbackPayload,
                    depositArgs.body,
                ),
            );
        });

        it('should handle deposit to receiver with success callback (body not included)', async () => {
            // Maxey deposit 5 TON to TON Vault with receiver bob, success callback and without body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    receiver: bob.address,
                    callbacks: {
                        successCallback: {
                            includeBody: false,
                            payload: successCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect the deposit to be successful
            await expectTONDepositTxs(
                depositResult,
                maxey,
                bob,
                tonVault,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey, successCallbackPayload),
            );
        });

        it('should handle deposit to receiver with success callback (body included)', async () => {
            // Maxey deposit 5 TON to TON Vault with receiver bob, success callback and with body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    receiver: bob.address,
                    callbacks: {
                        successCallback: {
                            includeBody: true,
                            payload: successCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect the deposit to be successful with success callback and in body
            await expectTONDepositTxs(
                depositResult,
                maxey,
                bob,
                tonVault,
                buildSuccessCallbackFp(
                    queryId,
                    depositAmount,
                    tonVault,
                    maxey,
                    successCallbackPayload,
                    depositArgs.body,
                ),
            );
        });

        it('should handle consecutive deposits correctly', async () => {
            // First deposit: Maxey deposit 3 TON to TON Vault
            const firstDepositAmount = toNano('3');
            const firstDepositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount: firstDepositAmount,
            });
            const firstDepositResult = await maxey.send(firstDepositArgs);

            // Expect the first deposit to be successful
            await expectTONDepositTxs(
                firstDepositResult,
                maxey,
                maxey,
                tonVault,
                buildSuccessCallbackFp(queryId, firstDepositAmount, tonVault, maxey),
            );

            // Second deposit: Maxey deposit another 7 TON to TON Vault
            const secondDepositAmount = toNano('7');
            const secondQueryId = 9n;
            const secondDepositArgs = await tonVault.getTonDepositArg({
                queryId: secondQueryId,
                depositAmount: secondDepositAmount,
            });
            const secondDepositResult = await maxey.send(secondDepositArgs);

            // Expect the second deposit to be successful
            await expectTONDepositTxs(
                secondDepositResult,
                maxey,
                maxey,
                tonVault,
                buildSuccessCallbackFp(secondQueryId, secondDepositAmount, tonVault, maxey),
            );
        });
    });

    describe('Deposit failure due to minimum shares not met and refund', () => {
        it('should handle basic deposit failure', async () => {
            // Maxey deposit 5 TON to TON Vault
            const depositAmount = toNano('5');
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    minShares: toNano('10'),
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect that deposit fail
            await expectTonDepositFailureFlows(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                maxeyTonBalBefore,
            );
        });

        it('should handle deposit failure with receiver', async () => {
            // Maxey deposit 5 TON to TON Vault
            const depositAmount = toNano('5');
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    minShares: toNano('10'),
                    receiver: bob.address,
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect that deposit fail
            await expectTonDepositFailureFlows(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                maxeyTonBalBefore,
            );
        });

        it('should handle deposit failure with failure callback (body not included)', async () => {
            // Maxey deposit 5 TON to TON Vault
            const depositAmount = toNano('5');
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    minShares: toNano('10'),
                    callbacks: {
                        failureCallback: {
                            includeBody: false,
                            payload: failCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect that deposit fail
            await expectTonDepositFailureFlows(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                maxeyTonBalBefore,
                failCallbackPayload,
            );
        });

        it('should handle deposit failure with failure callback (body included)', async () => {
            // Maxey deposit 5 TON to TON Vault
            const depositAmount = toNano('5');
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    minShares: toNano('10'),
                    callbacks: {
                        failureCallback: {
                            includeBody: true,
                            payload: failCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect that deposit fail
            await expectTonDepositFailureFlows(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                maxeyTonBalBefore,
                failCallbackPayload,
                depositArgs.body,
            );
        });

        it('should handle deposit failure with receiver and failure callback (body not included)', async () => {
            // Maxey deposit 5 TON to TON Vault
            const depositAmount = toNano('5');
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    minShares: toNano('10'),
                    receiver: bob.address,
                    callbacks: {
                        failureCallback: {
                            includeBody: false,
                            payload: failCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect that deposit fail
            await expectTonDepositFailureFlows(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                maxeyTonBalBefore,
                failCallbackPayload,
            );
        });

        it('should handle deposit failure with receiver and failure callback (body included)', async () => {
            // Maxey deposit 5 TON to TON Vault
            const depositAmount = toNano('5');
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    minShares: toNano('10'),
                    receiver: bob.address,
                    callbacks: {
                        failureCallback: {
                            includeBody: true,
                            payload: failCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect that deposit fail
            await expectTonDepositFailureFlows(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                maxeyTonBalBefore,
                failCallbackPayload,
                depositArgs.body,
            );
        });
    });
});
