import SignalMarketAMM from 0xae8d45e9591b80cb

transaction(marketId: UInt64, amountA: UFix64, amountB: UFix64) {
    prepare(signer: AuthAccount) {
        let _ = SignalMarketAMM.addLiquidity(
            marketId: marketId,
            amountA: amountA,
            amountB: amountB,
            provider: signer.address
        )
    }
}


