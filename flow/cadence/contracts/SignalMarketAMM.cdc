import "FlowToken"
import "FungibleToken"

/// SignalMarketAMM - Automated Market Maker for intelligence signal trading
/// Implements constant-product formula (x*y=k) bonding curve
access(all) contract SignalMarketAMM {
    
    access(all) struct Market {
        marketId: UInt64
        reserveA: UFix64  // Base token (FLOW)
        reserveB: UFix64  // Intelligence token
        totalSupply: UFix64
        active: Bool
        createdAt: UFix64
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
        pre {
            self.markets[marketId] == nil: "Market already exists"
        }
        
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
        amountB: UFix64
    ): UFix64 {
        pre {
            amountA > 0.0: "AmountA must be greater than 0"
            amountB > 0.0: "AmountB must be greater than 0"
            self.markets[marketId] != nil: "Market does not exist"
        }
        
        let market = &self.markets[marketId] as &Market
        pre {
            market.active: "Market must be active"
        }
        
        let lpTokens: UFix64
        
        if market.totalSupply == 0.0 {
            // First liquidity provision
            lpTokens = sqrt(amountA * amountB)
            pre {
                lpTokens >= self.MIN_LIQUIDITY: "Insufficient liquidity"
            }
        } else {
            // Subsequent liquidity provision
            let liquidityA = (amountA * market.totalSupply) / market.reserveA
            let liquidityB = (amountB * market.totalSupply) / market.reserveB
            lpTokens = min(liquidityA, liquidityB)
        }
        
        market.reserveA = market.reserveA + amountA
        market.reserveB = market.reserveB + amountB
        market.totalSupply = market.totalSupply + lpTokens
        
        emit LiquidityAdded(
            marketId: marketId,
            provider: self.getAccountCaller(),
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
        amountIn: UFix64
    ): UFix64 {
        pre {
            amountIn > 0.0: "AmountIn must be greater than 0"
            self.markets[marketId] != nil: "Market does not exist"
        }
        
        let market = &self.markets[marketId] as &Market
        pre {
            market.active: "Market must be active"
        }
        
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
        market.reserveA = newReserveA
        market.reserveB = newReserveB
        
        emit SignalSwapped(
            marketId: marketId,
            buyer: self.getAccountCaller(),
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
    
    access(all) fun getAccountCaller(): Address {
        return self.owner?.address ?? panic("Cannot get caller")
    }
    
    /// Helper: integer square root
    access(all) fun sqrt(n: UFix64): UFix64 {
        if n == 0.0 {
            return 0.0
        }
        var x = n
        var y = (x + 1.0) / 2.0
        while y < x {
            x = y
            y = (x + (n / x)) / 2.0
        }
        return x
    }
}
