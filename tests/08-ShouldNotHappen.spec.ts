import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { TestVault } from '../wrappers/TestVault';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { VaultErrors } from '../wrappers/constants/error';

describe('TestVault', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('TestVault');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let testVault: SandboxContract<TestVault>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        testVault = blockchain.openContract(
            TestVault.createFromConfig(
                {
                    id: 0,
                    counter: 0,
                },
                code,
            ),
        );

        deployer = await blockchain.treasury('deployer');

        const deployResult = await testVault.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: testVault.address,
            deploy: true,
            success: true,
        });
    });

    it('should throw ERR_INVALID_TRANSFER_AMOUNT when transfer amount is 0', async () => {
        const r = await testVault.sendInvalidTransferAmount(deployer.getSender(), {
            value: toNano('0.05'),
        });

        expect(r.transactions).toHaveTransaction({
            from: deployer.address,
            to: testVault.address,
            success: false,
            exitCode: VaultErrors.InvalidTransferAmount,
        });
    });

    it('should throw ERR_MISSING_JETTON_WALLET when missing jetton wallet', async () => {
        const r = await testVault.sendMissingJettonWallet(deployer.getSender(), {
            value: toNano('0.05'),
        });

        expect(r.transactions).toHaveTransaction({
            from: deployer.address,
            to: testVault.address,
            success: false,
            exitCode: VaultErrors.MissingJettonWallet,
        });
    });

    it('should not throw when rounding type is invalid (enters UB)', async () => {
        // See contracts/mock/test-vault.tolk line 79-99 for more details
        const r = await testVault.sendWrongRoundingType(deployer.getSender(), {
            value: toNano('0.05'),
        });

        expect(r.transactions).toHaveTransaction({
            from: deployer.address,
            to: testVault.address,
            success: true,
        });
    });
});
