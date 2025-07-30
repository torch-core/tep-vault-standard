import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, Cell, toNano } from '@ton/core';
import { buildSuccessCallbackFp } from './helper/callbackPayload';
import { expectFailDepositTONTxs, expectTONDepositTxs } from './helper/expectTxResults';
import { VaultErrors } from '../wrappers/constants/error';
import { expectDepositedEmitLog } from './helper/emitLog';
import { expectVaultSharesAndAssets } from './helper/expectVault';
import { expectTonDepositorBalances, expectTonVaultBalances } from './helper/expectBalances';
import { JettonWallet } from '@ton/ton';

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
    const DEPOSIT_FAIL_GAS = toNano('0.015');

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, tonVault } = getTestContext());
        maxeyShareWallet = blockchain.openContract(JettonWallet.create(await tonVault.getWalletAddress(maxey.address)));
        bobShareWallet = blockchain.openContract(JettonWallet.create(await tonVault.getWalletAddress(bob.address)));
        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        maxeyTonBalBefore = await maxey.getBalance();
        bobShareBalBefore = await bobShareWallet.getBalance();
        tonVaultTONBalBefore = (await blockchain.getContract(tonVault.address)).balance;
        tonVaultTonBalDelta = 0n;
    });

    afterEach(async () => {
        const tonVaultTONBalanceAfter = (await blockchain.getContract(tonVault.address)).balance;
        expect(tonVaultTONBalanceAfter - tonVaultTonBalDelta).toBeGreaterThanOrEqual(tonVaultTONBalBefore);
    });

    async function expectTonDepositFlows(
        depositResult: SendMessageResult,
        depositor: SandboxContract<TreasuryContract>,
        receiver: SandboxContract<TreasuryContract>,
        receiverShareWallet: SandboxContract<JettonWallet>,
        receiverShareBalBefore: bigint,
        depositorTonBalBefore: bigint,
        depositAmount: bigint,
        successCallbackPayload: Cell,
        oldTotalAssets: bigint = 0n,
        oldTotalSupply: bigint = 0n,
    ) {
        // Expect the deposit to be successful
        await expectTONDepositTxs(depositResult, depositor, receiver, tonVault, successCallbackPayload);

        // Expect that depositor shares and ton balances are updated
        await expectTonDepositorBalances(
            depositor,
            receiverShareWallet,
            receiverShareBalBefore,
            depositorTonBalBefore,
            depositAmount,
            depositAmount,
        );

        // Expect that tonVault balance is increased by depositAmount and shares/assets are increased by depositAmount
        await expectTonVaultBalances(
            blockchain,
            tonVault,
            tonVaultTONBalBefore,
            depositAmount,
            depositAmount,
            oldTotalAssets,
            oldTotalSupply,
        );

        // Expect that deposited emit log is emitted
        expectDepositedEmitLog(depositResult, depositor.address, receiver.address, depositAmount, depositAmount);

        // Update tonVaultTonBalDelta
        tonVaultTonBalDelta += depositAmount;
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
            await expectTonDepositFlows(
                depositResult,
                maxey,
                bob,
                bobShareWallet,
                bobShareBalBefore,
                maxeyTonBalBefore,
                depositAmount,
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
            await expectTonDepositFlows(
                depositResult,
                maxey,
                bob,
                bobShareWallet,
                bobShareBalBefore,
                maxeyTonBalBefore,
                depositAmount,
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
            await expectTonDepositFlows(
                depositResult,
                maxey,
                bob,
                bobShareWallet,
                bobShareBalBefore,
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

        it('should handle consecutive deposits correctly', async () => {
            // First deposit: Maxey deposit 3 TON to TON Vault
            const firstDepositAmount = toNano('3');
            const firstDepositArgs = await tonVault.getTonDepositArg({
                queryId,
                depositAmount: firstDepositAmount,
            });
            const firstDepositResult = await maxey.send(firstDepositArgs);

            // Expect the first deposit to be successful
            await expectTonDepositFlows(
                firstDepositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyTonBalBefore,
                firstDepositAmount,
                buildSuccessCallbackFp(queryId, firstDepositAmount, tonVault, maxey),
            );

            // Update maxey share and ton balances
            maxeyShareBalBefore = await maxeyShareWallet.getBalance();
            maxeyTonBalBefore = await maxey.getBalance();

            // Second deposit: Maxey deposit another 7 TON to TON Vault
            const secondDepositAmount = toNano('7');
            const secondQueryId = 9n;
            const secondDepositArgs = await tonVault.getTonDepositArg({
                queryId: secondQueryId,
                depositAmount: secondDepositAmount,
            });
            const secondDepositResult = await maxey.send(secondDepositArgs);

            // Expect the second deposit to be successful
            await expectTonDepositFlows(
                secondDepositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyTonBalBefore,
                secondDepositAmount,
                buildSuccessCallbackFp(secondQueryId, secondDepositAmount, tonVault, maxey),
                firstDepositAmount,
                firstDepositAmount,
            );
        });
    });

    describe('Deposit failure due to minimum shares not met and refund', () => {
        afterEach(async () => {
            // Bob share should be same
            const bobShareBalAfter = await bobShareWallet.getBalance();
            expect(bobShareBalAfter).toBe(bobShareBalBefore);

            // Expect that maxey ton balance is only decreased by gas fee
            const maxeyTonBalanceAfter = await maxey.getBalance();
            expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEPOSIT_FAIL_GAS);

            // Expect that tonVault shares and total assets are not updated
            await expectVaultSharesAndAssets(tonVault, 0n, 0n);
        });

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
            expectFailDepositTONTxs(depositResult, maxey, tonVault, queryId, VaultErrors.MinShareNotMet);
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
            expectFailDepositTONTxs(depositResult, maxey, tonVault, queryId, VaultErrors.MinShareNotMet);
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
            expectFailDepositTONTxs(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
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
            expectFailDepositTONTxs(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
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
            expectFailDepositTONTxs(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
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
            expectFailDepositTONTxs(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                failCallbackPayload,
                depositArgs.body,
            );
        });
    });
});
