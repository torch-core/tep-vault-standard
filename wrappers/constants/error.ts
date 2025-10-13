export const VaultErrors = {
    // General Errors (0-999)
    WrongOpCode: 0xffff,
    UnauthorizedAdmin: 1000,
    InvalidJettonWallet: 1001,
    InvalidJettonMaster: 1002,
    MissingJettonInfo: 1003,
    MissingExtraCurrencyInfo: 1004,
    InvalidRoundingType: 1005,
    InvalidTransferAmount: 1006,

    // Deposit Errors (2000-2999)
    MissingForwardPayload: 2000,
    InvalidDepositAmount: 2001,
    ExceededMaxDeposit: 2002,
    FailedMinShares: 2003,
    InsufficientTonDepositGas: 2004,
    InsufficientJettonDepositGas: 2005,
    InsufficientExtraCurrencyDepositGas: 2006,
    NonSupportedTonDeposit: 2007,
    InvalidExtraCurrencyId: 2008,
    MultiExtraCurrencyDeposit: 2009,

    // Withdraw Errors (3000-3999)
    UnauthorizedBurn: 3000,
    MissingCustomPayload: 3001,
    ExceededMaxWithdraw: 3002,
    FailedMinWithdraw: 3003,
    InsufficientWithdrawGas: 3004,
    InvalidBurnAmount: 3005,

    // Quote Operation Errors (4000-4999)
    InsufficientProvideQuoteGas: 4000,
};
