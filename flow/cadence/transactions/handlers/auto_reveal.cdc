import SignalCommitRegistry from 0xae8d45e9591b80cb

transaction(signalId: UInt64) {
    prepare(signer: AuthAccount) {
        SignalCommitRegistry.autoReveal(signalId: signalId)
    }
}


