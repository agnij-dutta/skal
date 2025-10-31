import "FlowToken"
import "FungibleToken"

/// SignalMarketAMM - Automated Market Maker for intelligence signal trading
/// Implements constant-product formula (x*y=k) bonding curve
access(all) contract SignalMarketAMM {
    // Helpers removed to avoid name resolution issues
    
    access(all) struct Market {
        access(all) let marketId: UInt64
        access(all) var reserveA: UFix64  // Base token (FLOW)
        access(all) var reserveB: UFix64  // Intelligence token
        access(all) var totalSupply: UFix64
        access(all) var active: Bool
        access(all) let createdAt: UFix64

        init(
            marketId: UInt64,
            reserveA: UFix64,
            reserveB: UFix64,
            totalSupply: UFix64,
            active: Bool,
            createdAt: UFix64
        ) {
            self.marketId = marketId
            self.reserveA = reserveA
            self.reserveB = reserveB
            self.totalSupply = totalSupply
            self.active = active
            self.createdAt = createdAt
        }
    }
    
    access(all) event MarketCreated(
        marketId: UInt64,
        timestamp: UFix64
    )
    
    access(all) event LiquidityAdded(
        marketId: UInt64,
        provider: Address,
        amountA: UFix64,
        amountB: UFix64,
        lpTokens: UFix64,
        timestamp: UFix64
    )
    
    access(all) event SignalSwapped(
        marketId: UInt64,
        buyer: Address,
        amountIn: UFix64,
        amountOut: UFix64,
        timestamp: UFix64
    )
    
    access(all) var markets: {UInt64: Market}
    access(all) var marketCount: UInt64
    
    access(all) let MIN_LIQUIDITY: UFix64  // Minimum liquidity units
    access(all) let FEE_PERCENT: UFix64  // 0.3% = 30/10000
    access(all) let PRECISION: UFix64  // 10000
    
    init() {
        self.markets = {}
        self.marketCount = 0
        self.MIN_LIQUIDITY = 1000.0
        self.FEE_PERCENT = 30.0
        self.PRECISION = 10000.0
    }
    
    /// Create a new market
    access(all) fun createMarket(marketId: UInt64): Bool {
        assert(self.markets[marketId] == nil, message: "Market already exists")
        
        let market = Market(
            marketId: marketId,
            reserveA: 0.0,
            reserveB: 0.0,
            totalSupply: 0.0,
            active: true,
            createdAt: self.getCurrentBlockTimestamp()
        )
        
        self.markets[marketId] = market
        self.marketCount = self.marketCount + 1
        
        emit MarketCreated(
            marketId: marketId,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Add liquidity to market
    access(all) fun addLiquidity(
        marketId: UInt64,
        amountA: UFix64,
        amountB: UFix64,
        provider: Address
    ): UFix64 {
        assert(amountA > 0.0, message: "AmountA must be greater than 0")
        assert(amountB > 0.0, message: "AmountB must be greater than 0")
        assert(self.markets[marketId] != nil, message: "Market does not exist")
        
        let market = self.markets[marketId]!
        assert(market.active, message: "Market must be active")
        
        var lpTokens: UFix64 = 0.0
        if market.totalSupply == 0.0 {
            // Simplified initial liquidity calculation
            lpTokens = amountA + amountB
            assert(lpTokens >= self.MIN_LIQUIDITY, message: "Insufficient liquidity")
        } else {
            // Subsequent liquidity provision
            let liquidityA = (amountA * market.totalSupply) / market.reserveA
            let liquidityB = (amountB * market.totalSupply) / market.reserveB
            var minVal: UFix64 = liquidityA
            if liquidityB < liquidityA { minVal = liquidityB }
            lpTokens = minVal
        }
        
        let updated = Market(
            marketId: market.marketId,
            reserveA: market.reserveA + amountA,
            reserveB: market.reserveB + amountB,
            totalSupply: market.totalSupply + lpTokens,
            active: market.active,
            createdAt: market.createdAt
        )
        self.markets[marketId] = updated
        
        emit LiquidityAdded(
            marketId: marketId,
            provider: provider,
            amountA: amountA,
            amountB: amountB,
            lpTokens: lpTokens,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return lpTokens
    }
    
    /// Swap tokens (buy signal)
    access(all) fun swapTokens(
        marketId: UInt64,
        amountIn: UFix64,
        buyer: Address
    ): UFix64 {
        assert(amountIn > 0.0, message: "AmountIn must be greater than 0")
        assert(self.markets[marketId] != nil, message: "Market does not exist")
        
        let market = self.markets[marketId]!
        assert(market.active, message: "Market must be active")
        
        // Calculate output amount using constant-product formula with fees
        let feeAmount = (amountIn * self.FEE_PERCENT) / self.PRECISION
        let amountInAfterFee = amountIn - feeAmount
        
        let reserveA = market.reserveA
        let reserveB = market.reserveB
        
        // Constant product formula: x * y = k
        // New reserveA = old reserveA + amountInAfterFee
        // New reserveB = (old reserveA * old reserveB) / new reserveA
        let newReserveA = reserveA + amountInAfterFee
        let newReserveB = (reserveA * reserveB) / newReserveA
        let amountOut = reserveB - newReserveB
        
        // Update reserves
        let updatedAfterSwap = Market(
            marketId: market.marketId,
            reserveA: newReserveA,
            reserveB: newReserveB,
            totalSupply: market.totalSupply,
            active: market.active,
            createdAt: market.createdAt
        )
        self.markets[marketId] = updatedAfterSwap
        
        emit SignalSwapped(
            marketId: marketId,
            buyer: buyer,
            amountIn: amountIn,
            amountOut: amountOut,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return amountOut
    }
    
    /// Get market details
    access(all) fun getMarket(marketId: UInt64): Market? {
        return self.markets[marketId]
    }
    
    /// Calculate output amount for swap (quotation)
    access(all) fun getOutputAmount(marketId: UInt64, amountIn: UFix64): UFix64? {
        if let market = self.markets[marketId] {
            let feeAmount = (amountIn * self.FEE_PERCENT) / self.PRECISION
            let amountInAfterFee = amountIn - feeAmount
            let newReserveA = market.reserveA + amountInAfterFee
            let newReserveB = (market.reserveA * market.reserveB) / newReserveA
            let amountOut = market.reserveB - newReserveB
            return amountOut
        }
        return nil
    }
    
    access(all) fun getCurrentBlockTimestamp(): UFix64 {
        return getCurrentBlock().timestamp
    }

    
}
