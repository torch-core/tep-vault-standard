import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { toNano } from '@ton/core';
import { VaultOpcodes } from '../wrappers/constants/op';
import { JettonOpcodes } from '../wrappers/jetton/JettonConstants';
import { JettonWallet } from '../wrappers/jetton/JettonWallet';

describe('Deposit to TON Vault', () => {
    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>;
    let maxey: SandboxContract<TreasuryContract>;
    let tonVault: SandboxContract<Vault>;

    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, admin, maxey, tonVault } = getTestContext());
    });

    it('should deposit TON to TON Vault', async () => {
        const depositAmount = toNano('5');
        const depositResult = await tonVault.sendDeposit(maxey.getSender(), {
            queryId: 8n,
            depositAmount,
        });

        // Expect that maxey send OP_VAULT_DEPOSIT to tonVault
        expect(depositResult.transactions).toHaveTransaction({
            from: maxey.address,
            to: tonVault.address,
            op: VaultOpcodes.Deposit,
            success: true,
        });

        // Expect that tonVault send OP_INTERNAL_TRANSFER to maxey share jetton wallet
        const maxeyShareWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await tonVault.getWalletAddress(maxey.address)),
        );
        expect(depositResult.transactions).toHaveTransaction({
            from: tonVault.address,
            to: maxeyShareWallet.address,
            op: JettonOpcodes.InternalTransfer,
            success: true,
        });

        // Expect that maxey share jetton wallet send OP_EXCESSES to maxey
        expect(depositResult.transactions).toHaveTransaction({
            from: maxeyShareWallet.address,
            to: maxey.address,
            op: JettonOpcodes.Excesses,
            success: true,
        });

        // Expect that maxey share jetton wallet send OP_TRANSFER_NOTIFICATION to maxey
        expect(depositResult.transactions).toHaveTransaction({
            from: maxeyShareWallet.address,
            to: maxey.address,
            op: JettonOpcodes.TransferNotification,
        });

        // Expect that maxey shares is depositAmount
        const maxeyShares = await maxeyShareWallet.getJettonBalance();
        expect(maxeyShares).toBe(depositAmount);
    });
});
