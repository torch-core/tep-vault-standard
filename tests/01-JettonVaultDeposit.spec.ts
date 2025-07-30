import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { JettonMaster, JettonWallet } from '@ton/ton';
import { expectJettonDepositTxs } from './helper/expectTxResults';
import { expectDepositedEmitLog } from './helper/emitLog';
import { expectJettonDepositorBalances, expectJettonVaultBalances } from './helper/expectBalances';
import { buildSuccessCallbackFp, buildTransferNotificationPayload } from './helper/callbackPayload';
import { beginCell, Cell } from '@ton/core';
import { Opcodes } from '../wrappers/constants/op';
import { OPCODE_SIZE } from '../wrappers/constants/size';

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
    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

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
        expect(vaultTonBalanceAfter).toBeGreaterThanOrEqual(vaultTonBalBefore);
    });

    async function expectJettonDepositFlows(
        depositResult: SendMessageResult,
        depositor: SandboxContract<TreasuryContract>,
        depositorJettonWallet: SandboxContract<JettonWallet>,
        depositorJettonWalletBalBefore: bigint,
        depositAmount: bigint,
        successCallbackPayload: Cell,
        receiver: SandboxContract<TreasuryContract>,
        receiverShareWallet: SandboxContract<JettonWallet>,
        receiverShareBalBefore: bigint,
        vault: SandboxContract<Vault>,
        vaultJettonWallet: SandboxContract<JettonWallet>,
        vaultJettonWalletBalBefore: bigint,
    ) {
        // Expect that deposit is successful
        await expectJettonDepositTxs(
            depositResult,
            depositor,
            depositorJettonWallet,
            receiver,
            vault,
            vaultJettonWallet,
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
        );

        // Expect that deposited emit log is emitted
        expectDepositedEmitLog(depositResult, depositor.address, receiver.address, depositAmount, depositAmount);
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
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, USDTVault, maxey),
                maxey,
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
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, USDTVault, maxey),
                bob,
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
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, USDTVault, maxey, successCallbackPayload),
                maxey,
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
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, USDTVault, maxey, successCallbackPayload, inBody),
                maxey,
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
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, USDTVault, maxey, successCallbackPayload),
                bob,
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
                maxey,
                maxeyUSDTWallet,
                maxeyUSDTWalletBalBefore,
                depositAmount,
                buildSuccessCallbackFp(queryId, depositAmount, USDTVault, maxey, successCallbackPayload, inBody),
                bob,
                bobShareWallet,
                bobShareBalBefore,
                USDTVault,
                vaultUSDTWallet,
                vaultUSDTWalletBalBefore,
            );
        });
    });

    describe('Deposit Jetton failure due to minimum shares not met and refund', () => {
        // TODO
    });
});
