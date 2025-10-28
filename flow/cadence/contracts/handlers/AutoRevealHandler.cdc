import "FlowTransactionScheduler"
import "SignalCommitRegistry"

/// AutoRevealHandler - Scheduled transaction to auto-reveal signals after deadline
access(all) contract AutoRevealHandler {
    
    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(FlowTransactionScheduler.Execute) fun executeTransaction(id: UInt64, data: AnyStruct?) {
            // Extract signalId from data
            if let signalIdStruct = data as? AutoRevealData {
                let signalId = signalIdStruct.signalId
                
                // Call auto-reveal on CommitRegistry
                SignalCommitRegistry.autoReveal(signalId: signalId)
                
                log("Auto-reveal executed for signal: ".concat(signalId.toString()))
            }
        }
        
        access(all) view fun getViews(): [Type] {
            return [Type<StoragePath>(), Type<PublicPath>()]
        }
        
        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<StoragePath>():
                    return /storage/AutoRevealHandler
                case Type<PublicPath>():
                    return /public/AutoRevealHandler
                default:
                    return nil
            }
        }
    }
    
    access(all) struct AutoRevealData {
        signalId: UInt64
    }
    
    access(all) fun createHandler(): @Handler {
        return <- create Handler()
    }
}
