import { Blockchain, printTransactionFees, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, Cell, toNano } from '@ton/core';
import { buildCallbackFp, DEFAULT_FAIL_CALLBACK_PAYLOAD, SUCCESS_RESULT } from './helper/callbackPayload';
import { expectEcDepositTxs, expectFailDepositTONTxs, expectTONDepositTxs } from './helper/expectTxResults';
import { VaultErrors } from '../wrappers/constants/error';
import { expectDepositedEmitLog } from './helper/emitLog';
import { expectEcVaultBalances, expectTonVaultBalances, expectVaultSharesAndAssets } from './helper/expectVault';
import { expectEcDepositorBalances, expectTonDepositorBalances } from './helper/expectBalances';
import { JettonWallet } from '@ton/ton';
import { Opcodes } from '../wrappers/constants/op';
import { writeFileSync } from 'fs';
import { MAX_COINS_VALUE } from './helper/constants';
import { Asset } from '@torch-finance/core';
import { OPCODE_SIZE } from '../wrappers/constants/size';

describe('Deposit to Extra Currency  Vault', () => {
    let blockchain: Blockchain;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalBefore: bigint;
    let maxeyEcBalBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalBefore: bigint;
    let ecVault: SandboxContract<Vault>;
    let ecVaultTONBalBefore: bigint;
    let ecVaultEcBalBefore: bigint;
    let ecVaultTonBalDelta: bigint;
    let ecId: number;
    const queryId = 8n;
    const DEPOSIT_FAIL_GAS = toNano('0.015');

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey, bob, ecVault, ecId } = getTestContext());
        maxeyShareWallet = blockchain.openContract(JettonWallet.create(await ecVault.getWalletAddress(maxey.address)));
        bobShareWallet = blockchain.openContract(JettonWallet.create(await ecVault.getWalletAddress(bob.address)));
        maxeyShareBalBefore = await maxeyShareWallet.getBalance();
        maxeyEcBalBefore = (await blockchain.getContract(maxey.address)).ec[ecId];
        bobShareBalBefore = await bobShareWallet.getBalance();
        const ecVaultSmc = await blockchain.getContract(ecVault.address);
        ecVaultTONBalBefore = ecVaultSmc.balance;
        ecVaultEcBalBefore = ecVaultSmc.ec[ecId] ?? 0n;
        ecVaultTonBalDelta = 0n;
    });

    afterEach(async () => {
        const ecVaultBalanceAfter = (await blockchain.getContract(ecVault.address)).balance;
        expect(ecVaultBalanceAfter - ecVaultTonBalDelta + 5n).toBeGreaterThanOrEqual(ecVaultTONBalBefore);
    });

    afterAll(() => {
        const coverage = blockchain.coverage(ecVault);
        if (!coverage) return;

        // Generate HTML report for detailed analysis
        const coverageJson = coverage.toJson();
        writeFileSync('./coverage/ton-vault-deposit.json', coverageJson);
    });

    async function expectEcDepositFlows(
        depositResult: SendMessageResult,
        depositor: SandboxContract<TreasuryContract>,
        receiver: SandboxContract<TreasuryContract>,
        receiverShareWallet: SandboxContract<JettonWallet>,
        receiverShareBalBefore: bigint,
        depositorEcBalBefore: bigint,
        depositAmount: bigint,
        successCallbackPayload: Cell,
        oldTotalAssets: bigint = 0n,
        oldTotalSupply: bigint = 0n,
    ) {
        // Expect the deposit to be successful
        await expectEcDepositTxs(depositResult, depositor.address, receiver.address, ecVault, successCallbackPayload);

        // Expect that depositor shares and ton balances are updated
        await expectEcDepositorBalances(
            blockchain,
            depositor,
            receiverShareWallet,
            receiverShareBalBefore,
            depositorEcBalBefore,
            depositAmount,
            depositAmount,
            ecId,
        );

        // Expect that tonVault balance is increased by depositAmount and shares/assets are increased by depositAmount
        await expectEcVaultBalances(
            blockchain,
            ecVault,
            ecVaultEcBalBefore,
            depositAmount,
            depositAmount,
            oldTotalAssets,
            oldTotalSupply,
            ecId,
        );

        // Expect that deposited emit log is emitted
        expectDepositedEmitLog(depositResult, depositor.address, receiver.address, depositAmount, depositAmount);
    }

    describe('Deposit Extra Currency success', () => {
        it('should handle basic deposit to depositor', async () => {
            // Maxey deposit 5 ecId: to ecVault
            const depositAmount = toNano('5');
            const depositArgs = await ecVault.getEcDepositArg({
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArgs);

            await expectEcDepositFlows(
                depositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyEcBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, ecVault, SUCCESS_RESULT, maxey),
            );
        });

        it('should handle deposit to specified receiver', async () => {
            // Maxey deposit 5 ecId: to ecVault with receiver bob
            const depositAmount = toNano('5');
            const depositArgs = await ecVault.getEcDepositArg({
                queryId,
                depositAmount,
                depositParams: {
                    receiver: bob.address,
                },
            });
            const depositResult = await maxey.send(depositArgs);

            // Expect the deposit to be successful
            await expectEcDepositFlows(
                depositResult,
                maxey,
                bob,
                bobShareWallet,
                bobShareBalBefore,
                maxeyEcBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, ecVault, SUCCESS_RESULT, maxey),
            );
        });

        it('should handle deposit with success callback (body not included)', async () => {
            // Maxey deposit 5 ecId:0 to ecVault with success callback and without body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await ecVault.getEcDepositArg({
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
            await expectEcDepositFlows(
                depositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyEcBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, ecVault, SUCCESS_RESULT, maxey, successCallbackPayload),
            );
        });

        it('should handle deposit with success callback (body included)', async () => {
            // Maxey deposit  5 ecId:0 to ecVault with success callback and with body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await ecVault.getEcDepositArg({
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
            await expectEcDepositFlows(
                depositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyEcBalBefore,
                depositAmount,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    ecVault,
                    SUCCESS_RESULT,
                    maxey,
                    successCallbackPayload,
                    depositArgs.body,
                ),
            );
        });

        it('should handle deposit to receiver with success callback (body not included)', async () => {
            // Maxey deposit  5 ecId:0 to ecVault with receiver bob, success callback and without body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await ecVault.getEcDepositArg({
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
            await expectEcDepositFlows(
                depositResult,
                maxey,
                bob,
                bobShareWallet,
                bobShareBalBefore,
                maxeyEcBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, ecVault, SUCCESS_RESULT, maxey, successCallbackPayload),
            );
        });

        it('should handle deposit to receiver with success callback (body included)', async () => {
            // Maxey deposit  5 ecId:0 to ecVault with receiver bob, success callback and with body
            const depositAmount = toNano('5');
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArgs = await ecVault.getEcDepositArg({
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
            await expectEcDepositFlows(
                depositResult,
                maxey,
                bob,
                bobShareWallet,
                bobShareBalBefore,
                maxeyEcBalBefore,
                depositAmount,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    ecVault,
                    SUCCESS_RESULT,
                    maxey,
                    successCallbackPayload,
                    depositArgs.body,
                ),
            );
        });

        it('should handle consecutive deposits correctly', async () => {
            // First deposit: Maxey deposit 3 TON to TON Vault
            const firstDepositAmount = toNano('3');
            const firstDepositArgs = await ecVault.getEcDepositArg({
                queryId,
                depositAmount: firstDepositAmount,
            });
            const firstDepositResult = await maxey.send(firstDepositArgs);

            // Expect the first deposit to be successful
            await expectEcDepositFlows(
                firstDepositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyEcBalBefore,
                firstDepositAmount,
                buildCallbackFp(queryId, firstDepositAmount, ecVault, SUCCESS_RESULT, maxey),
            );

            // Update maxey share and ton balances
            maxeyShareBalBefore = await maxeyShareWallet.getBalance();
            maxeyEcBalBefore = (await blockchain.getContract(maxey.address)).ec[ecId];
            ecVaultEcBalBefore = (await blockchain.getContract(ecVault.address)).ec[ecId];

            // Second deposit: Maxey deposit another 7 TON to TON Vault
            const secondDepositAmount = toNano('7');
            const secondQueryId = 9n;
            const secondDepositArgs = await ecVault.getEcDepositArg({
                queryId: secondQueryId,
                depositAmount: secondDepositAmount,
            });
            const secondDepositResult = await maxey.send(secondDepositArgs);

            // Expect the second deposit to be successful
            await expectEcDepositFlows(
                secondDepositResult,
                maxey,
                maxey,
                maxeyShareWallet,
                maxeyShareBalBefore,
                maxeyEcBalBefore,
                secondDepositAmount,
                buildCallbackFp(secondQueryId, secondDepositAmount, ecVault, SUCCESS_RESULT, maxey),
                firstDepositAmount,
                firstDepositAmount,
            );
        });
    });

    // describe('Deposit failure due to minimum shares not met and refund', () => {
    //     afterEach(async () => {
    //         // Bob share should be same
    //         const bobShareBalAfter = await bobShareWallet.getBalance();
    //         expect(bobShareBalAfter).toBe(bobShareBalBefore);

    //         // Expect that maxey ton balance is only decreased by gas fee
    //         const maxeyTonBalanceAfter = await maxey.getBalance();
    //         expect(maxeyTonBalanceAfter).toBeGreaterThan(maxeyTonBalBefore - DEPOSIT_FAIL_GAS);

    //         // Expect that tonVault shares and total assets are not updated
    //         await expectVaultSharesAndAssets(ecVault, 0n, 0n);
    //     });

    //     it('should handle basic deposit failure', async () => {
    //         // Maxey deposit  5 ecId:0 to ecVault
    //         const depositAmount = toNano('5');
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //             depositParams: {
    //                 minShares: toNano('10'),
    //             },
    //         });
    //         const depositResult = await maxey.send(depositArgs);

    //         // Expect that deposit fail
    //         expectFailDepositTONTxs(
    //             depositResult,
    //             maxey.address,
    //             ecVault,
    //             queryId,
    //             VaultErrors.FailedMinShares,
    //             DEFAULT_FAIL_CALLBACK_PAYLOAD,
    //         );
    //     });

    //     it('should handle deposit failure with receiver', async () => {
    //         // Maxey deposit  5 ecId:0 to ecVault
    //         const depositAmount = toNano('5');
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //             depositParams: {
    //                 minShares: toNano('10'),
    //                 receiver: bob.address,
    //             },
    //         });
    //         const depositResult = await maxey.send(depositArgs);

    //         // Expect that deposit fail
    //         expectFailDepositTONTxs(
    //             depositResult,
    //             maxey.address,
    //             ecVault,
    //             queryId,
    //             VaultErrors.FailedMinShares,
    //             DEFAULT_FAIL_CALLBACK_PAYLOAD,
    //         );
    //     });

    //     it('should handle deposit failure with failure callback (body not included)', async () => {
    //         // Maxey deposit  5 ecId:0 to ecVault
    //         const depositAmount = toNano('5');
    //         const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //             depositParams: {
    //                 minShares: toNano('10'),
    //                 callbacks: {
    //                     failureCallback: {
    //                         includeBody: false,
    //                         payload: failCallbackPayload,
    //                     },
    //                 },
    //             },
    //         });
    //         const depositResult = await maxey.send(depositArgs);

    //         // Expect that deposit fail
    //         expectFailDepositTONTxs(
    //             depositResult,
    //             maxey.address,
    //             ecVault,
    //             queryId,
    //             VaultErrors.FailedMinShares,
    //             failCallbackPayload,
    //         );
    //     });

    //     it('should handle deposit failure with failure callback (body included)', async () => {
    //         // Maxey deposit  5 ecId:0 to ecVault
    //         const depositAmount = toNano('5');
    //         const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //             depositParams: {
    //                 minShares: toNano('10'),
    //                 callbacks: {
    //                     failureCallback: {
    //                         includeBody: true,
    //                         payload: failCallbackPayload,
    //                     },
    //                 },
    //             },
    //         });
    //         const depositResult = await maxey.send(depositArgs);

    //         // Expect that deposit fail
    //         expectFailDepositTONTxs(
    //             depositResult,
    //             maxey.address,
    //             ecVault,
    //             queryId,
    //             VaultErrors.FailedMinShares,
    //             failCallbackPayload,
    //             depositArgs.body,
    //         );
    //     });

    //     it('should handle deposit failure with receiver and failure callback (body not included)', async () => {
    //         // Maxey deposit  5 ecId:0 to ecVault
    //         const depositAmount = toNano('5');
    //         const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //             depositParams: {
    //                 minShares: toNano('10'),
    //                 receiver: bob.address,
    //                 callbacks: {
    //                     failureCallback: {
    //                         includeBody: false,
    //                         payload: failCallbackPayload,
    //                     },
    //                 },
    //             },
    //         });
    //         const depositResult = await maxey.send(depositArgs);

    //         // Expect that deposit fail
    //         expectFailDepositTONTxs(
    //             depositResult,
    //             maxey.address,
    //             ecVault,
    //             queryId,
    //             VaultErrors.FailedMinShares,
    //             failCallbackPayload,
    //         );
    //     });

    //     it('should handle deposit failure with receiver and failure callback (body included)', async () => {
    //         // Maxey deposit  5 ecId:0 to ecVault
    //         const depositAmount = toNano('5');
    //         const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //             depositParams: {
    //                 minShares: toNano('10'),
    //                 receiver: bob.address,
    //                 callbacks: {
    //                     failureCallback: {
    //                         includeBody: true,
    //                         payload: failCallbackPayload,
    //                     },
    //                 },
    //             },
    //         });
    //         const depositResult = await maxey.send(depositArgs);

    //         // Expect that deposit fail
    //         expectFailDepositTONTxs(
    //             depositResult,
    //             maxey.address,
    //             ecVault,
    //             queryId,
    //             VaultErrors.FailedMinShares,
    //             failCallbackPayload,
    //             depositArgs.body,
    //         );
    //     });
    // });

    // describe('Other failure cases', () => {
    //     it('should throw ERR_INSUFFICIENT_TON_DEPOSIT_GAS when valueCoins < depositAmount + deposit gas', async () => {
    //         // Maxey deposit  5 ecId:0 to ecVault
    //         const depositAmount = toNano('5');
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //         });
    //         const depositResult = await maxey.send({
    //             to: depositArgs.to,
    //             value: depositArgs.value - toNano('2'),
    //             body: depositArgs.body,
    //         });

    //         // Expect that deposit fail
    //         expect(depositResult.transactions).toHaveTransaction({
    //             from: maxey.address,
    //             to: ecVault.address,
    //             op: Opcodes.Vault.Deposit,
    //             success: false,
    //             exitCode: VaultErrors.InsufficientTonDepositGas,
    //         });
    //     });
    //     it('should throw INVALID_DEPOSIT_AMOUNT when deposit amount is 0', async () => {
    //         // Maxey deposit 0 TON to TON Vault
    //         const depositAmount = toNano('0');
    //         const depositArgs = await ecVault.getTonDepositArg({
    //             queryId,
    //             depositAmount,
    //         });
    //         const depositResult = await maxey.send(depositArgs);

    //         // Expect that maxey send OP_DEPOSIT to TON Vault but throw INVALID_DEPOSIT_AMOUNT
    //         expect(depositResult.transactions).toHaveTransaction({
    //             from: maxey.address,
    //             to: ecVault.address,
    //             op: Opcodes.Vault.Deposit,
    //             success: false,
    //             exitCode: VaultErrors.InvalidDepositAmount,
    //         });
    //     });
    // });

    // describe('Get methods', () => {
    //     it('should preview ton deposit fee', async () => {
    //         const fee = await ecVault.getPreviewTonDepositFee();
    //         expect(fee).toBe(toNano('0.012'));
    //     });

    //     it('should get max deposit', async () => {
    //         const maxDepositAmount = await ecVault.getMaxDeposit();
    //         expect(maxDepositAmount).toBe(MAX_COINS_VALUE);
    //     });

    //     it('should get assets', async () => {
    //         const assets = await ecVault.getAssets();
    //         expect(assets[0].equals(Asset.ton())).toBeTruthy();
    //     });

    //     it('should get total assets', async () => {
    //         const totalAssets = await ecVault.getTotalAssets();
    //         expect(totalAssets).toBe(0n);
    //     });

    //     it('should get convert to shares', async () => {
    //         const convertToShares = await ecVault.getConvertToShares(toNano('10'));
    //         expect(convertToShares).toBe(toNano('10'));
    //     });
    // });

    // describe('Other cases', () => {
    //     it('should throw when wrong op to ton vault', async () => {
    //         const result = await maxey.send({
    //             to: ecVault.address,
    //             value: toNano('0.05'),
    //             body: beginCell().storeUint(123, OPCODE_SIZE).endCell(),
    //         });

    //         // Expect maxey sends OP_INCREASE to ton vault and exit with NOT_AUTHORIZED
    //         expect(result.transactions).toHaveTransaction({
    //             from: maxey.address,
    //             to: ecVault.address,
    //             success: false,
    //             exitCode: VaultErrors.WrongOpCode,
    //         });
    //     });

    //     it('should ton vault receive TON', async () => {
    //         const sendingAmount = toNano('0.05');
    //         const result = await maxey.send({
    //             to: ecVault.address,
    //             value: sendingAmount,
    //         });

    //         // Expect maxey sends TON to ton vault and success
    //         expect(result.transactions).toHaveTransaction({
    //             from: maxey.address,
    //             to: ecVault.address,
    //             success: true,
    //         });
    //     });
    // });
});
