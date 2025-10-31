import SignalMarketAMM from 0xae8d45e9591b80cb

transaction(marketId: UInt64) {
    prepare(signer: AuthAccount) {
        SignalMarketAMM.createMarket(marketId: marketId)
    }
}


