import SignalMarketAMM from 0xae8d45e9591b80cb

access(all) fun main(marketId: UInt64): SignalMarketAMM.Market? {
    return SignalMarketAMM.getMarket(marketId: marketId)
}



