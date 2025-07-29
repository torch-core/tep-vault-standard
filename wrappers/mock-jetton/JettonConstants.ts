export abstract class JettonOpcodes {
    static Transfer = 0xf8a7ea5;
    static TransferNotification = 0x7362d09c;
    static InternalTransfer = 0x178d4519;
    static Excesses = 0xd53276db;
    static Burn = 0x595f07bc;
    static BurnNotification = 0x7bdd97de;

    static ProvideWalletAddress = 0x2c76b973;
    static TakeWalletAddress = 0xd1735400;
    static Mint = 0x642b7d07;
    static ChangeAdmin = 0x6501f354;
    static ClaimAdmin = 0xfb88e119;
    static Upgrade = 0x2508d66a;
    static CallTo = 0x235caf52;
    static TopUp = 0xd372158c;
    static ChangeMetadataUrl = 0xcb862902;
    static SetStatus = 0xeed236d3;
}

export abstract class JettonErrors {
    static InvalidOp = 72;
    static WrongOp = 0xffff;
    static NotOwner = 73;
    static NotValidWallet = 74;
    static WrongWorkchain = 333;

    static ContractLocked = 45;
    static BalanceError = 47;
    static NotEnoughGas = 48;
    static InvalidMessage = 49;
    static DiscoveryFeeNotMatched = 75;
}
