import "DeFiActions"
import "FungibleToken"

/// SignalSourceConnector - Implements Source interface for Flow Actions
/// Provides FLOW tokens from user vaults for signal purchases
access(all) struct SignalSourceConnector: DeFiActions.Source {
    let uniqueID: DeFiActions.UniqueIdentifier?
    
    let vaultRef: &{FungibleToken.Vault}
    
    init(
        vaultRef: &{FungibleToken.Vault},
        uniqueID: DeFiActions.UniqueIdentifier?
    ) {
        self.vaultRef = vaultRef
        self.uniqueID = uniqueID
    }
    
    /// Returns the Vault type provided by this Source
    access(all) fun getSourceType(): Type {
        return Type<@{FungibleToken.Vault}>()
    }
    
    /// Returns an estimate of how much can be withdrawn
    access(all) fun minimumAvailable(): UFix64 {
        return self.vaultRef.balance
    }
    
    /// Withdraws up to maxAmount, returning what's actually available
    access(FungibleToken.Withdraw) fun withdrawAvailable(maxAmount: UFix64): @{FungibleToken.Vault} {
        let available = self.vaultRef.balance
        let amount = min(available, maxAmount)
        return self.vaultRef.withdraw(amount: amount)
    }
    
    /// Get unique identifier
    access(all) fun id(): DeFiActions.UniqueIdentifier? {
        return self.uniqueID
    }
}
