import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, toNano } from '@ton/core';
import { JettonWallet } from '../wrappers/mock-jetton/JettonWallet';
import { buildSuccessCallbackFp } from './helper/callback';
import { expectDepositedVaultStorage, expectFailDepositTON, expectTONDeposit } from './helper/expect';
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
    const DEFAULT_GAS_FEE = toNano('0.05');

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
            await expectTONDeposit(
                depositResult,
                maxey,
                maxey,
                tonVault,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey),
            );

            // Expect that maxey shares is depositAmount
            const maxeyShareBalanceAfter = await maxeyShareWallet.getJettonBalance();
            expect(maxeyShareBalanceAfter).toBe(maxeyShareBalBefore + depositAmount);

            // Expect that vault storage is updated
            await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);

            // Expect that deposited emit log is emitted
            expectDepositedEmitLog(depositResult, maxey.address, maxey.address, depositAmount, depositAmount);
            tonVaultTonBalDelta = depositAmount;
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
            await expectTONDeposit(
                depositResult,
                maxey,
                bob,
                tonVault,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey),
            );

            // Expect that bob shares is depositAmount
            const bobShareBalanceAfter = await bobShareWallet.getJettonBalance();
            expect(bobShareBalanceAfter).toBe(bobShareBalBefore + depositAmount);

            // Expect that vault storage is updated
            await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);

            // Expect that deposited emit log is emitted
            expectDepositedEmitLog(depositResult, maxey.address, bob.address, depositAmount, depositAmount);
            tonVaultTonBalDelta = depositAmount;
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
            await expectTONDeposit(
                depositResult,
                maxey,
                maxey,
                tonVault,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey, successCallbackPayload),
            );

            // Expect that vault storage is updated
            await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);

            // Expect that deposited emit log is emitted
            expectDepositedEmitLog(depositResult, maxey.address, maxey.address, depositAmount, depositAmount);
            tonVaultTonBalDelta = depositAmount;
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
            await expectTONDeposit(
                depositResult,
                maxey,
                maxey,
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

            // Expect that vault storage is updated
            await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);

            // Expect that deposited emit log is emitted
            expectDepositedEmitLog(depositResult, maxey.address, maxey.address, depositAmount, depositAmount);
            tonVaultTonBalDelta = depositAmount;
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
            await expectTONDeposit(
                depositResult,
                maxey,
                bob,
                tonVault,
                buildSuccessCallbackFp(queryId, depositAmount, tonVault, maxey, successCallbackPayload),
            );

            // Expect that vault storage is updated
            await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);

            // Expect that deposited emit log is emitted
            expectDepositedEmitLog(depositResult, maxey.address, bob.address, depositAmount, depositAmount);
            tonVaultTonBalDelta = depositAmount;
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
            await expectTONDeposit(
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

            // Expect that vault storage is updated
            await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);

            // Expect that deposited emit log is emitted
            expectDepositedEmitLog(depositResult, maxey.address, bob.address, depositAmount, depositAmount);
            tonVaultTonBalDelta = depositAmount;
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
            await expectTONDeposit(
                firstDepositResult,
                maxey,
                maxey,
                tonVault,
                buildSuccessCallbackFp(queryId, firstDepositAmount, tonVault, maxey),
            );

            // Check shares and vault storage after first deposit
            const maxeyShareBalanceAfterFirst = await maxeyShareWallet.getJettonBalance();
            expect(maxeyShareBalanceAfterFirst).toBe(maxeyShareBalBefore + firstDepositAmount);
            await expectDepositedVaultStorage(tonVault, firstDepositAmount, firstDepositAmount);

            // Second deposit: Maxey deposit another 7 TON to TON Vault
            const secondDepositAmount = toNano('7');
            const secondQueryId = 9n;
            const secondDepositArgs = await tonVault.getTonDepositArg({
                queryId: secondQueryId,
                depositAmount: secondDepositAmount,
            });
            const secondDepositResult = await maxey.send(secondDepositArgs);

            // Expect the second deposit to be successful
            await expectTONDeposit(
                secondDepositResult,
                maxey,
                maxey,
                tonVault,
                buildSuccessCallbackFp(secondQueryId, secondDepositAmount, tonVault, maxey),
            );

            // Check final shares and vault storage after both deposits
            const totalDepositAmount = firstDepositAmount + secondDepositAmount;
            const maxeyShareBalanceAfterSecond = await maxeyShareWallet.getJettonBalance();
            expect(maxeyShareBalanceAfterSecond).toBe(maxeyShareBalBefore + totalDepositAmount);
            await expectDepositedVaultStorage(tonVault, totalDepositAmount, totalDepositAmount);

            // Expect that deposited emit log is emitted
            expectDepositedEmitLog(
                secondDepositResult,
                maxey.address,
                maxey.address,
                secondDepositAmount,
                secondDepositAmount,
            );
            tonVaultTonBalDelta = totalDepositAmount;
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
            expectFailDepositTON(depositResult, maxey, tonVault, queryId, VaultErrors.MinShareNotMet);

            // Expect that maxey ton balance is only decreased by gas fee
            const maxeyTonBalanceAfter = await maxey.getBalance();
            expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEFAULT_GAS_FEE);

            // Expect that tonVault shares and total assets are not updated
            await expectDepositedVaultStorage(tonVault, 0n, 0n);
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
            expectFailDepositTON(depositResult, maxey, tonVault, queryId, VaultErrors.MinShareNotMet);

            // Expect that maxey ton balance is only decreased by gas fee
            const maxeyTonBalanceAfter = await maxey.getBalance();
            expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEFAULT_GAS_FEE);

            // Expect that tonVault shares and total assets are not updated
            await expectDepositedVaultStorage(tonVault, 0n, 0n);
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
            expectFailDepositTON(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                failCallbackPayload,
            );

            // Expect that maxey ton balance is only decreased by gas fee
            const maxeyTonBalanceAfter = await maxey.getBalance();
            expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEFAULT_GAS_FEE);

            // Expect that tonVault shares and total assets are not updated
            await expectDepositedVaultStorage(tonVault, 0n, 0n);
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
            expectFailDepositTON(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                failCallbackPayload,
                depositArgs.body,
            );

            // Expect that maxey ton balance is only decreased by gas fee
            const maxeyTonBalanceAfter = await maxey.getBalance();
            expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEFAULT_GAS_FEE);

            // Expect that tonVault shares and total assets are not updated
            await expectDepositedVaultStorage(tonVault, 0n, 0n);
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
            expectFailDepositTON(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                failCallbackPayload,
            );

            // Expect that maxey ton balance is only decreased by gas fee
            const maxeyTonBalanceAfter = await maxey.getBalance();
            expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEFAULT_GAS_FEE);

            // Expect that tonVault shares and total assets are not updated
            await expectDepositedVaultStorage(tonVault, 0n, 0n);
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
            expectFailDepositTON(
                depositResult,
                maxey,
                tonVault,
                queryId,
                VaultErrors.MinShareNotMet,
                failCallbackPayload,
                depositArgs.body,
            );

            // Expect that maxey ton balance is only decreased by gas fee
            const maxeyTonBalanceAfter = await maxey.getBalance();
            expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEFAULT_GAS_FEE);

            // Expect that tonVault shares and total assets are not updated
            await expectDepositedVaultStorage(tonVault, 0n, 0n);
        });
    });
});
