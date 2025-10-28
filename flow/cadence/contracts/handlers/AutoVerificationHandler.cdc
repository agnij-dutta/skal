import "FlowTransactionScheduler"
import "SignalCommitRegistry"
import "SignalEscrow"

/// AutoVerificationHandler - Scheduled verification checks and fund release
access(all) contract AutoVerificationHandler {
    
    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(FlowTransactionScheduler.Execute) fun executeTransaction(id: UInt64, data: AnyStruct?) {
            // Extract verification data
            if let verifyData = data as? VerificationData {
                let signalId = verifyData.signalId
                let validationScore = verifyData.score
                
                // Validate the signal
                SignalCommitRegistry.validateSignal(signalId: signalId, score: validationScore)
                
                // Settle the signal (release/refund funds based on score)
                if validationScore >= 70 {  // Threshold for successful validation
                    SignalCommitRegistry.settleSignal(signalId: signalId)
                    SignalEscrow.releaseFunds(signalId: signalId)
                } else {
                    // Validation failed - refund buyer
                    SignalEscrow.refundFunds(signalId: signalId)
                }
                
                log("Auto-verification executed for signal: ".concat(signalId.toString()))
            }
        }
        
        access(all) view fun getViews(): [Type] {
            return [Type<StoragePath>(), Type<PublicPath>()]
        }
        
        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<StoragePath>():
                    return /storage/AutoVerificationHandler
                case Type<PublicPath>():
                    return /public/AutoVerificationHandler
                default:
                    return nil
            }
        }
    }
    
    access(all) struct VerificationData {
        signalId: UInt64
        score: UInt8
    }
    
    access(all) fun createHandler(): @Handler {
        return <- create Handler()
    }
}
