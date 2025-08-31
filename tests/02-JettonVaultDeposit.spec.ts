import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonMaster, JettonWallet } from '@ton/ton';
import { expectFailDepositJettonTxs, expectJettonDepositTxs } from './helper/expectTxResults';
import { expectDepositedEmitLog } from './helper/emitLog';
import { expectJettonDepositorBalances } from './helper/expectBalances';
import {
    buildCallbackFp,
    buildTransferNotificationPayload,
    DEFAULT_FAIL_CALLBACK_PAYLOAD,
    SUCCESS_RESULT,
} from './helper/callbackPayload';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { Opcodes } from '../wrappers/constants/op';
import { OPCODE_SIZE } from '../wrappers/constants/size';
import { VaultErrors } from '../wrappers/constants/error';
import { expectJettonVaultBalances, expectVaultSharesAndAssets } from './helper/expectVault';
import { writeFileSync } from 'fs';
import { Asset } from '@torch-finance/core';

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
    const { getTestContext, resetToInitSnapshot, deployJettonMinter } = createTestEnvironment();

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
        expect(vaultTonBalanceAfter + 8n).toBeGreaterThanOrEqual(vaultTonBalBefore);
    });

    afterAll(() => {
        const coverage = blockchain.coverage(USDTVault);
        if (!coverage) return;

        // Generate HTML report for detailed analysis
        const coverageJson = coverage.toJson();
        writeFileSync('./coverage/jetton-vault-deposit.json', coverageJson);
    });

    async function expectJettonDepositFlows(
        depositResult: SendMessageResult,
        depositor: Address,
        depositorJettonWallet: SandboxContract<JettonWallet>,
        depositorJettonWalletBalBefore: bigint,
        depositAmount: bigint,
        successCallbackPayload: Cell,
        receiver: Address,
        receiverShareWallet: SandboxContract<JettonWallet>,
        receiverShareBalBefore: bigint,
        vault: SandboxContract<Vault>,
        vaultJettonWallet: SandboxContract<JettonWallet>,
        vaultJettonWalletBalBefore: bigint,
        oldTotalAssets: bigint = 0n,
        oldTotalSupply: bigint = 0n,
    ) {
        // Expect that deposit is successful
        await expectJettonDepositTxs(
            depositResult,
            depositor,
            depositorJettonWallet.address,
            receiver,
            vault,
            vaultJettonWallet.address,
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
            oldTotalAssets,
            oldTotalSupply,
        );

        // Expect that deposited emit log is emitted
        expectDepositedEmitLog(depositResult, depositor, receiver, depositAmount, depositAmount);
    }

    describe('Deposit Jetton success', () => {
        it('should handle basic deposit to depositor', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArg);

            // Expect that deposit is successful
            await expectJettonDepositFlows(
                depositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, USDTVault, SUCCESS_RESULT, maxey),
                maxey.address,
                maxeyShareWallet,
                maxeyShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });

        it('should handle deposit to specified receiver', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams: {
                    receiver: bob.address,
                },
            });
            const depositResult = await maxey.send(depositArg);

            // Expect that deposit is successful
            await expectJettonDepositFlows(
                depositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, USDTVault, SUCCESS_RESULT, maxey),
                bob.address,
                bobShareWallet,
                bobShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });

        it('should handle deposit with success callback (body not included)', async () => {
            const depositAmount = 10000n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
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
            const depositResult = await maxey.send(depositArg);

            // Expect that deposit is successful
            await expectJettonDepositFlows(
                depositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, USDTVault, SUCCESS_RESULT, maxey, successCallbackPayload),
                maxey.address,
                maxeyShareWallet,
                maxeyShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });

        it('should handle deposit with success callback (body included)', async () => {
            const depositAmount = 10000n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositParams = {
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams,
            });
            const depositResult = await maxey.send(depositArg);

            const inBody = buildTransferNotificationPayload(
                queryId,
                depositAmount,
                maxey.address,
                beginCell()
                    .storeUint(Opcodes.Vault.DepositFp, OPCODE_SIZE)
                    .store(USDTVault.storeVaultDepositParams(depositParams))
                    .endCell(),
            );

            // Expect that deposit is successful
            await expectJettonDepositFlows(
                depositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    SUCCESS_RESULT,
                    maxey,
                    successCallbackPayload,
                    inBody,
                ),
                maxey.address,
                maxeyShareWallet,
                maxeyShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });

        it('should handle deposit to receiver with success callback (body not included)', async () => {
            const depositAmount = 10000n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
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
            const depositResult = await maxey.send(depositArg);

            // Expect that deposit is successful
            await expectJettonDepositFlows(
                depositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildCallbackFp(queryId, depositAmount, USDTVault, SUCCESS_RESULT, maxey, successCallbackPayload),
                bob.address,
                bobShareWallet,
                bobShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });

        it('should handle deposit to receiver with success callback (body included)', async () => {
            const depositAmount = 10000n;
            const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositParams = {
                receiver: bob.address,
                callbacks: {
                    successCallback: {
                        includeBody: true,
                        payload: successCallbackPayload,
                    },
                },
            };
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams,
            });
            const depositResult = await maxey.send(depositArg);

            const inBody = buildTransferNotificationPayload(
                queryId,
                depositAmount,
                maxey.address,
                beginCell()
                    .storeUint(Opcodes.Vault.DepositFp, OPCODE_SIZE)
                    .store(USDTVault.storeVaultDepositParams(depositParams))
                    .endCell(),
            );

            // Expect that deposit is successful
            await expectJettonDepositFlows(
                depositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    SUCCESS_RESULT,
                    maxey,
                    successCallbackPayload,
                    inBody,
                ),
                bob.address,
                bobShareWallet,
                bobShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });

        it('should handle consecutive deposits correctly', async () => {
            // First deposit: Maxey deposit 0.01 USDT to USDTVault
            const firstDepositAmount = 10000n;
            const firstDepositArgs = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount: firstDepositAmount,
            });
            const firstDepositResult = await maxey.send(firstDepositArgs);

            // Expect the first deposit to be successful
            await expectJettonDepositFlows(
                firstDepositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                firstDepositAmount,
                buildCallbackFp(queryId, firstDepositAmount, USDTVault, SUCCESS_RESULT, maxey),
                maxey.address,
                maxeyShareWallet,
                maxeyShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );

            // Update maxey share and USDT balances
            maxeyShareBalBefore = await maxeyShareWallet.getBalance();
            maxeyUSDTWalletBalBefore = await maxeyUSDTWallet.getBalance();

            // Update vaultUSDTWalletBalBefore
            vaultUSDTWalletBalBefore = await vaultUSDTWallet.getBalance();

            // Second deposit: Maxey deposit another 0.01 USDT to USDTVault
            const secondDepositAmount = 10000n;
            const secondQueryId = 9n;
            const secondDepositArgs = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId: secondQueryId,
                depositAmount: secondDepositAmount,
            });
            const secondDepositResult = await maxey.send(secondDepositArgs);

            // Expect the second deposit to be successful
            await expectJettonDepositFlows(
                secondDepositResult,
                maxey.address,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                secondDepositAmount,
                buildCallbackFp(secondQueryId, secondDepositAmount, USDTVault, SUCCESS_RESULT, maxey),
                maxey.address,
                maxeyShareWallet,
                maxeyShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
                firstDepositAmount,
                firstDepositAmount,
            );
        });
    });

    describe('Deposit Jetton failure due to minimum shares not met and refund', () => {
        afterEach(async () => {
            // Maxey USDT balance should be the same as before the deposit
            expect(await maxeyUSDTWallet.getBalance()).toBe(maxeyUSDTWalletBalBefore);

            // Vault totalSupply and totalAssets should be the same as before the deposit
            await expectVaultSharesAndAssets(USDTVault, 0n, 0n);
        });
        it('should handle basic deposit failure', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams: {
                    minShares: depositAmount + 1n,
                },
            });
            const depositResult = await maxey.send(depositArg);

            await expectFailDepositJettonTxs(
                depositResult,
                maxey.address,
                maxeyUSDTWallet.address,
                vaultUSDTWallet.address,
                USDTVault,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    VaultErrors.FailedMinShares,
                    maxey,
                    DEFAULT_FAIL_CALLBACK_PAYLOAD,
                ),
            );
        });

        it('should handle deposit failure with receiver', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams: {
                    minShares: depositAmount + 1n,
                    receiver: bob.address,
                },
            });
            const depositResult = await maxey.send(depositArg);

            await expectFailDepositJettonTxs(
                depositResult,
                maxey.address,
                maxeyUSDTWallet.address,
                vaultUSDTWallet.address,
                USDTVault,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    VaultErrors.FailedMinShares,
                    maxey,
                    DEFAULT_FAIL_CALLBACK_PAYLOAD,
                ),
            );
        });

        it('should handle deposit failure with failure callback (body not included)', async () => {
            const depositAmount = 10000n;
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams: {
                    minShares: depositAmount + 1n,
                    callbacks: {
                        failureCallback: {
                            includeBody: false,
                            payload: failCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArg);

            await expectFailDepositJettonTxs(
                depositResult,
                maxey.address,
                maxeyUSDTWallet.address,
                vaultUSDTWallet.address,
                USDTVault,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    VaultErrors.FailedMinShares,
                    maxey,
                    failCallbackPayload,
                ),
            );
        });

        it('should handle deposit failure with failure callback (body included)', async () => {
            const depositAmount = 10000n;
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositParams = {
                minShares: depositAmount + 1n,
                callbacks: {
                    failureCallback: {
                        includeBody: true,
                        payload: failCallbackPayload,
                    },
                },
            };
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams,
            });
            const depositResult = await maxey.send(depositArg);

            const inBody = buildTransferNotificationPayload(
                queryId,
                depositAmount,
                maxey.address,
                beginCell()
                    .storeUint(Opcodes.Vault.DepositFp, OPCODE_SIZE)
                    .store(USDTVault.storeVaultDepositParams(depositParams))
                    .endCell(),
            );

            await expectFailDepositJettonTxs(
                depositResult,
                maxey.address,
                maxeyUSDTWallet.address,
                vaultUSDTWallet.address,
                USDTVault,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    VaultErrors.FailedMinShares,
                    maxey,
                    failCallbackPayload,
                    inBody,
                ),
            );
        });

        it('should handle deposit failure with receiver and failure callback (body not included)', async () => {
            const depositAmount = 10000n;
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams: {
                    minShares: depositAmount + 1n,
                    receiver: bob.address,
                    callbacks: {
                        failureCallback: {
                            includeBody: false,
                            payload: failCallbackPayload,
                        },
                    },
                },
            });
            const depositResult = await maxey.send(depositArg);

            await expectFailDepositJettonTxs(
                depositResult,
                maxey.address,
                maxeyUSDTWallet.address,
                vaultUSDTWallet.address,
                USDTVault,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    VaultErrors.FailedMinShares,
                    maxey,
                    failCallbackPayload,
                ),
            );
        });

        it('should handle deposit failure with receiver and failure callback (body included)', async () => {
            const depositAmount = 10000n;
            const failCallbackPayload = beginCell().storeUint(1, 32).endCell();
            const depositParams = {
                minShares: depositAmount + 1n,
                receiver: bob.address,
                callbacks: {
                    failureCallback: {
                        includeBody: true,
                        payload: failCallbackPayload,
                    },
                },
            };
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
                depositParams,
            });
            const depositResult = await maxey.send(depositArg);

            const inBody = buildTransferNotificationPayload(
                queryId,
                depositAmount,
                maxey.address,
                beginCell()
                    .storeUint(Opcodes.Vault.DepositFp, OPCODE_SIZE)
                    .store(USDTVault.storeVaultDepositParams(depositParams))
                    .endCell(),
            );

            await expectFailDepositJettonTxs(
                depositResult,
                maxey.address,
                maxeyUSDTWallet.address,
                vaultUSDTWallet.address,
                USDTVault,
                buildCallbackFp(
                    queryId,
                    depositAmount,
                    USDTVault,
                    VaultErrors.FailedMinShares,
                    maxey,
                    failCallbackPayload,
                    inBody,
                ),
            );
        });
    });

    describe('Other failure cases', () => {
        it('should throw ERR_NON_SUPPORTED_TON_DEPOSIT when deposit TON in jetton vault', async () => {
            const depositAmount = toNano('0.01');
            const depositArgs = await USDTVault.getTonDepositArg({
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArgs);

            expect(depositResult.transactions).toHaveTransaction({
                from: maxey.address,
                to: USDTVault.address,
                op: Opcodes.Vault.Deposit,
                success: false,
                exitCode: VaultErrors.NonSupportedTonDeposit,
            });
        });
        it('should throw ERR_NON_SUPPORTED_EXTRA_CURRENCY_DEPOSIT when deposit Extra Currency in jetton vault', async () => {
            const depositAmount = toNano('0.01');
            const depositArgs = await USDTVault.getEcDepositArg(
                {
                    queryId,
                    depositAmount,
                },
                0,
            );
            const depositResult = await maxey.send(depositArgs);

            expect(depositResult.transactions).toHaveTransaction({
                from: maxey.address,
                to: USDTVault.address,
                op: Opcodes.Vault.DepositEc,
                success: false,
                exitCode: VaultErrors.NonSupportedExtraCurrencyDeposit,
            });
        });
        it('should throw ERR_INSUFFICIENT_JETTON_DEPOSIT_GAS when valueCoins < deposit gas', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(
                maxey.address,
                {
                    queryId,
                    depositAmount,
                },
                undefined,
                toNano('0.01'),
            );
            const depositResult = await maxey.send(depositArg);

            // Expect that deposit fail
            expect(depositResult.transactions).toHaveTransaction({
                from: vaultUSDTWallet.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.TransferNotification,
                success: false,
                exitCode: VaultErrors.InsufficientJettonDepositGas,
            });
        });
        it('should throw INVALID_DEPOSIT_AMOUNT when deposit amount is 0', async () => {
            const depositAmount = 0n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send(depositArg);

            // Expect that vault Jetton wallet send OP_TRANSFER_NOTIFICATION_FOR_MINTER but throw INVALID_DEPOSIT_AMOUNT
            expect(depositResult.transactions).toHaveTransaction({
                from: vaultUSDTWallet.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.TransferNotification,
                success: false,
                exitCode: VaultErrors.InvalidDepositAmount,
            });
        });

        it('should throw INVALID_JETTON_WALLET when Jetton master is not the vault', async () => {
            // Deploy fake Jetton master
            const fakeJetton = await deployJettonMinter(blockchain, maxey, 'Fake Jetton');
            const maxeyFakeJettonWalletAddress = await fakeJetton.getWalletAddress(maxey.address);
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send({
                to: maxeyFakeJettonWalletAddress,
                value: depositArg.value,
                body: depositArg.body,
            });

            // Expect that vault fake Jetton wallet send OP_TRANSFER_NOTIFICATION_FOR_MINTER but throw INVALID_JETTON_WALLET
            const vaultFakeJettonWalletAddress = await fakeJetton.getWalletAddress(USDTVault.address);
            expect(depositResult.transactions).toHaveTransaction({
                from: vaultFakeJettonWalletAddress,
                to: USDTVault.address,
                op: Opcodes.Jetton.TransferNotification,
                success: false,
                exitCode: VaultErrors.InvalidJettonWallet,
            });
        });

        it('should throw NULL_FORWARD_PAYLOAD when forward payload is null', async () => {
            const depositAmount = 10000n;
            const depositArg = await USDTVault.getJettonDepositArg(maxey.address, {
                queryId,
                depositAmount,
            });
            const depositResult = await maxey.send({
                to: depositArg.to,
                value: depositArg.value,
                body: beginCell()
                    .store(
                        USDTVault.storeJettonTransferMessage({
                            queryId,
                            amount: depositAmount,
                            recipient: USDTVault.address,
                            responseDst: maxey.address,
                            forwardAmount: toNano('0.05'),
                        }),
                    )
                    .endCell(),
            });

            // Expect that vault Jetton wallet send OP_TRANSFER_NOTIFICATION_FOR_MINTER but throw NULL_FORWARD_PAYLOAD
            expect(depositResult.transactions).toHaveTransaction({
                from: vaultUSDTWallet.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.TransferNotification,
                success: false,
                exitCode: VaultErrors.MissingForwardPayload,
            });
        });
    });

    describe('Get methods', () => {
        it('should preview jetton deposit fee', async () => {
            const fee = await USDTVault.getPreviewJettonDepositFee();
            expect(fee).toBe(toNano('0.012'));
        });

        it('should get assets', async () => {
            const assets = await USDTVault.getAssets();
            expect(assets[0].equals(Asset.jetton(USDT.address))).toBeTruthy();
        });
    });
});
