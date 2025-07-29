import { compile } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { JettonMinter } from '../../wrappers/mock-jetton/JettonMinter';

/**
 * Deploys a Jetton Master (minter) contract on the blockchain.
 * Mints an initial supply to the admin address.
 */
export const deployJettonMinter = async (
    blockchain: Blockchain,
    deployer: SandboxContract<TreasuryContract>,
    name: string,
    admin?: Address,
    decimals: number = 6,
    premint: bigint = 1000_000_000_000n,
) => {
    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');
    let jetton: SandboxContract<JettonMinter>;
    jetton = blockchain.openContract(
        await JettonMinter.createFromConfig(
            {
                admin: admin ?? deployer.address,
                wallet_code: jettonWalletCode,
                jetton_content: { uri: name },
            },
            jettonMinterCode,
        ),
    );

    await jetton.sendDeploy(deployer.getSender(), toNano('1.5'));

    // Mint some tokens to admin
    await jetton.sendMint(deployer.getSender(), deployer.address, premint * BigInt(10 ** decimals));

    return jetton;
};
