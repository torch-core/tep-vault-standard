import "schemas/deposit"
import "schemas/withdraw"
import "schemas/deploy"
import "schemas/provide-take-quote"

type AllowedMessage = Deposit | TransferNotificationForRecipient | BurnNotificationForMinter | DeployVault | ResponseWalletAddress | ProvideQuote;