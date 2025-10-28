import "DeFiActions"
import "FungibleToken"

/// SignalSinkConnector - Implements Sink interface for Flow Actions
/// Accepts payments up to capacity and deposits to signal providers
access(all) struct SignalSinkConnector: DeFiActions.Sink {
    let uniqueID: DeFiActions.UniqueIdentifier?
    
    let vaultRef: &{FungibleToken.Vault}
    let maxCapacity: UFix64?
    
    init(
        vaultRef: &{FungibleToken.Vault},
        maxCapacity: UFix64?,
        uniqueID: DeFiActions.UniqueIdentifier?
    ) {
        self.vaultRef = vaultRef
        self.maxCapacity = maxCapacity
        self.uniqueID = uniqueID
    }
    
    /// Returns the Vault type accepted by this Sink
    access(all) fun getSinkType(): Type {
        return Type<@{FungibleToken.Vault}>()
    }
    
    /// Returns an estimate of remaining capacity
    access(all) fun minimumCapacity(): UFix64 {
        if let max = self.maxCapacity {
            let current = self.vaultRef.balance
            if max > current {
                return max - current
            }
        }
        return 0.0
    }
    
    /// Deposits up to capacity, leaving remainder in the referenced vault
    access(all) fun depositCapacity(from: auth(FungibleToken.Withdraw) &{FungibleToken.Vault}) {
        let amount = from.balance
        
        if let max = self.maxCapacity {
            let current = self.vaultRef.balance
            let remaining = max - current
            let toDeposit = min(amount, remaining)
            
            self.vaultRef.deposit(from: <-from.withdraw(amount: toDeposit))
        } else {
            // No capacity limit
            self.vaultRef.deposit(from: <-from)
        }
    }
    
    /// Get unique identifier
    access(all) fun id(): DeFiActions.UniqueIdentifier? {
        return self.uniqueID
    }
}
