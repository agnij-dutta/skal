import { ethers } from 'ethers'
import { 
  TaskFeatures, 
  MarketData, 
  Reserves, 
  LiquidityRatio,
  ArbitrageOpportunity
} from './types.js'

export class LocalMLModels {
  private taskQualityModel: Map<string, number> = new Map()
  private pricePredictionModel: Map<number, number[]> = new Map()
  private anomalyThreshold = 0.8

  /**
   * Fast prediction of task quality using local ML models
   */
  predictTaskQuality(features: TaskFeatures): number {
    // Decision tree-like logic for fast screening
    let score = 0.5 // Base score

    // Provider reputation factor (0-1)
    score += features.providerReputation * 0.3

    // Stake amount factor (reasonable stakes get higher scores)
    const stakeFactor = Math.max(0, 1 - Math.abs(features.stakeAmount - 0.05) / 0.05)
    score += stakeFactor * 0.2

    // Market volatility factor (moderate volatility preferred)
    const volatilityFactor = Math.max(0, 1 - Math.abs(features.marketVolatility - 0.2) / 0.3)
    score += volatilityFactor * 0.15

    // Time factor (recent commits preferred)
    const timeFactor = Math.max(0, 1 - features.timeSinceCommit / 3600000) // 1 hour decay
    score += timeFactor * 0.1

    // Market liquidity factor
    const liquidityFactor = Math.min(1, features.marketLiquidity / 10000)
    score += liquidityFactor * 0.15

    // Competition factor (less competition = higher score)
    score += (1 - features.competitionLevel) * 0.1

    // Historical success rate
    score += features.historicalSuccessRate * 0.2

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Calculate expected return based on market data
   */
  calculateExpectedReturn(marketData: MarketData): number {
    // Simple linear model based on market conditions
    let expectedReturn = 0.05 // Base 5% return

    // Volatility bonus (higher volatility = higher potential return)
    expectedReturn += marketData.volatility * 0.1

    // Liquidity bonus (more liquid markets = better returns)
    const liquidityFactor = Math.min(1, Number(marketData.totalSupply) / 1000000)
    expectedReturn += liquidityFactor * 0.05

    // Volume factor (higher volume = more opportunities)
    const volumeFactor = Math.min(1, Number(marketData.volume24h) / 100000)
    expectedReturn += volumeFactor * 0.03

    return Math.max(0.01, Math.min(0.5, expectedReturn)) // Cap between 1% and 50%
  }

  /**
   * Optimize liquidity ratio for AMM
   */
  optimizeLiquidityRatio(params: {
    requestedA: bigint
    requestedB: bigint
    currentReserveA: bigint
    currentReserveB: bigint
    prediction?: any
  }): LiquidityRatio {
    const { requestedA, requestedB, currentReserveA, currentReserveB, prediction } = params

    // Calculate current ratio
    const currentRatio = Number(currentReserveA) / Number(currentReserveB)
    
    // Calculate requested ratio
    const requestedRatio = Number(requestedA) / Number(requestedB)

    // If prediction suggests price movement, adjust ratio
    let optimalRatio = requestedRatio
    if (prediction && prediction.predictedPrice > prediction.currentPrice) {
      // Price going up, add more of token A (base)
      optimalRatio *= 1.1
    } else if (prediction && prediction.predictedPrice < prediction.currentPrice) {
      // Price going down, add more of token B
      optimalRatio *= 0.9
    }

    // Calculate optimal amounts maintaining the ratio
    const totalValue = Number(requestedA) + Number(requestedB)
    const optimalAmountA = BigInt(Math.floor(totalValue * optimalRatio / (1 + optimalRatio)))
    const optimalAmountB = BigInt(Math.floor(totalValue / (1 + optimalRatio)))

    // Calculate expected return based on ratio optimization
    const expectedReturn = this.calculateLiquidityReturn(
      optimalAmountA,
      optimalAmountB,
      currentReserveA,
      currentReserveB
    )

    return {
      amountA: optimalAmountA,
      amountB: optimalAmountB,
      ratio: optimalRatio,
      expectedReturn
    }
  }

  /**
   * Detect anomalies in market activity
   */
  detectAnomalies(activities: any[]): boolean {
    if (activities.length < 3) return false

    // Calculate moving average and standard deviation
    const values = activities.map(a => Number(a.value || 0))
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    // Check if latest activity is anomaly
    const latest = values[values.length - 1]
    const zScore = Math.abs(latest - mean) / (stdDev || 1)

    return zScore > 2.5 // 2.5 standard deviations = anomaly
  }

  /**
   * Simple price prediction using linear regression
   */
  predictPrice(marketId: number, historicalPrices: number[]): number {
    if (historicalPrices.length < 2) return historicalPrices[0] || 1

    // Simple linear trend
    const n = historicalPrices.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = historicalPrices

    // Calculate slope
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0)
    const sumXX = x.reduce((a, b) => a + b * b, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Predict next price
    const nextPrice = slope * n + intercept

    // Store for learning
    this.pricePredictionModel.set(marketId, [...(this.pricePredictionModel.get(marketId) || []), nextPrice])

    return Math.max(0.01, nextPrice) // Ensure positive price
  }

  /**
   * Calculate optimal position size based on Kelly Criterion
   */
  calculateOptimalPositionSize(
    winRate: number,
    averageWin: number,
    averageLoss: number,
    totalCapital: bigint
  ): bigint {
    if (averageLoss === 0) return 0n

    // Kelly Criterion: f = (bp - q) / b
    // where b = average win / average loss, p = win rate, q = 1 - win rate
    const b = averageWin / averageLoss
    const p = winRate
    const q = 1 - winRate

    const kellyFraction = (b * p - q) / b

    // Cap at 25% of capital for safety
    const maxFraction = 0.25
    const optimalFraction = Math.max(0, Math.min(kellyFraction, maxFraction))

    return BigInt(Math.floor(Number(totalCapital) * optimalFraction))
  }

  /**
   * Detect arbitrage opportunities between markets
   */
  detectArbitrageOpportunities(markets: MarketData[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = []

    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const market1 = markets[i]
        const market2 = markets[j]

        // Calculate price difference
        const price1 = Number(market1.reserveB) / Number(market1.reserveA)
        const price2 = Number(market2.reserveB) / Number(market2.reserveA)

        const priceDiff = Math.abs(price1 - price2) / Math.min(price1, price2)

        if (priceDiff > 0.05) { // 5% price difference
          const expectedProfit = priceDiff * 0.8 // Assume 80% of difference as profit
          const estimatedCost = Math.min(Number(market1.reserveA), Number(market2.reserveA)) * 0.1

          opportunities.push({
            fromMarket: market1.marketId,
            toMarket: market2.marketId,
            expectedProfit,
            estimatedCost,
            confidence: Math.min(0.9, priceDiff * 2),
            timeframe: 300 // 5 minutes
          })
        }
      }
    }

    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit)
  }

  /**
   * Calculate expected return for liquidity provision
   */
  private calculateLiquidityReturn(
    amountA: bigint,
    amountB: bigint,
    reserveA: bigint,
    reserveB: bigint
  ): number {
    if (reserveA === 0n || reserveB === 0n) return 0

    // Calculate share of pool
    const totalSupply = reserveA + reserveB
    const userSupply = amountA + amountB
    const share = Number(userSupply) / Number(totalSupply)

    // Estimate fees based on historical volume (simplified)
    const estimatedDailyFees = Number(totalSupply) * 0.001 // 0.1% daily fees
    const userDailyFees = estimatedDailyFees * share

    // Annual return
    const annualReturn = (userDailyFees * 365) / Number(userSupply)

    return Math.max(0, annualReturn)
  }

  /**
   * Update model based on new data (simple online learning)
   */
  updateModel(modelType: string, input: any, output: number): void {
    const key = `${modelType}_${JSON.stringify(input)}`
    const currentValue = this.taskQualityModel.get(key) || 0.5
    const learningRate = 0.1

    // Simple exponential moving average
    const newValue = currentValue + learningRate * (output - currentValue)
    this.taskQualityModel.set(key, newValue)
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(): { accuracy: number; predictions: number; lastUpdated: number } {
    const predictions = this.taskQualityModel.size
    const accuracy = 0.7 // Simplified - would calculate from actual performance
    const lastUpdated = Date.now()

    return { accuracy, predictions, lastUpdated }
  }
}
