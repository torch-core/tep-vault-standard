import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, toNano } from '@ton/core';
import { JettonWallet } from '../wrappers/jetton/JettonWallet';
import { buildSuccessCallbackPayload } from './helper/callback';
import { expectDepositedVaultStorage, expectTONDeposit } from './helper/expect';

describe('Deposit to TON Vault', () => {
    let blockchain: Blockchain;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let maxeyShareWallet: SandboxContract<JettonWallet>;
    let maxeyShareBalanceBefore: bigint;
    let bobShareWallet: SandboxContract<JettonWallet>;
    let bobShareBalanceBefore: bigint;
    let tonVault: SandboxContract<Vault>;
    const queryId = 8n;

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
        maxeyShareBalanceBefore = await maxeyShareWallet.getJettonBalance();
        bobShareBalanceBefore = await bobShareWallet.getJettonBalance();
    });

    it('should successfully deposit TON and mint share tokens to depositor', async () => {
        // Maxey deposit 5 TON to TON Vault
        const depositAmount = toNano('5');
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), {
            queryId,
            depositAmount,
        });

        // Expect the deposit to be successful
        await expectTONDeposit(
            depositResult,
            maxey,
            maxey,
            tonVault,
            buildSuccessCallbackPayload(queryId, depositAmount, tonVault, maxey),
        );

        // Expect that maxey shares is depositAmount
        const maxeyShareBalanceAfter = await maxeyShareWallet.getJettonBalance();
        expect(maxeyShareBalanceAfter).toBe(maxeyShareBalanceBefore + depositAmount);

        // Expect that vault storage is updated
        await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);
    });

    it('should successfully deposit TON and mint share tokens to specified receiver', async () => {
        // Maxey deposit 5 TON to TON Vault with receiver bob
        const depositAmount = toNano('5');
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), {
            queryId,
            depositAmount,
            depositParams: {
                receiver: bob.address,
            },
        });

        // Expect the deposit to be successful
        await expectTONDeposit(
            depositResult,
            maxey,
            bob,
            tonVault,
            buildSuccessCallbackPayload(queryId, depositAmount, tonVault, maxey),
        );

        // Expect that bob shares is depositAmount
        const bobShareBalanceAfter = await bobShareWallet.getJettonBalance();
        expect(bobShareBalanceAfter).toBe(bobShareBalanceBefore + depositAmount);

        // Expect that vault storage is updated
        await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);
    });

    it('should successfully deposit TON and trigger success callback without including body', async () => {
        // Maxey deposit 5 TON to TON Vault with success callback and without body
        const depositAmount = toNano('5');
        const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), {
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

        // Expect the deposit to be successful
        await expectTONDeposit(
            depositResult,
            maxey,
            maxey,
            tonVault,
            buildSuccessCallbackPayload(queryId, depositAmount, tonVault, maxey, successCallbackPayload),
        );

        // Expect that vault storage is updated
        await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);
    });

    it('should successfully deposit TON and trigger success callback with body included', async () => {
        // Maxey deposit 5 TON to TON Vault with success callback and with body
        const depositAmount = toNano('5');
        const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
        const depositParams = {
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
        };
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), depositParams);

        // Expect the deposit to be successful with success callback and in body
        await expectTONDeposit(
            depositResult,
            maxey,
            maxey,
            tonVault,
            buildSuccessCallbackPayload(
                queryId,
                depositAmount,
                tonVault,
                maxey,
                successCallbackPayload,
                Vault.createVaultDepositArg(depositParams).body,
            ),
        );

        // Expect that vault storage is updated
        await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);
    });

    it('should successfully deposit TON to receiver and trigger success callback without body', async () => {
        // Maxey deposit 5 TON to TON Vault with receiver bob, success callback and without body
        const depositAmount = toNano('5');
        const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), {
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

        // Expect the deposit to be successful
        await expectTONDeposit(
            depositResult,
            maxey,
            bob,
            tonVault,
            buildSuccessCallbackPayload(queryId, depositAmount, tonVault, maxey, successCallbackPayload),
        );

        // Expect that vault storage is updated
        await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);
    });

    it('should successfully deposit TON to receiver and trigger success callback with body included', async () => {
        // Maxey deposit 5 TON to TON Vault with receiver bob, success callback and with body
        const depositAmount = toNano('5');
        const successCallbackPayload = beginCell().storeUint(1, 32).endCell();
        const depositParams = {
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
        };
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), depositParams);

        // Expect the deposit to be successful with success callback and in body
        await expectTONDeposit(
            depositResult,
            maxey,
            bob,
            tonVault,
            buildSuccessCallbackPayload(
                queryId,
                depositAmount,
                tonVault,
                maxey,
                successCallbackPayload,
                Vault.createVaultDepositArg(depositParams).body,
            ),
        );

        // Expect that vault storage is updated
        await expectDepositedVaultStorage(tonVault, depositAmount, depositAmount);
    });
});
