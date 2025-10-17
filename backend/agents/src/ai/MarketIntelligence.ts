import { ethers } from 'ethers'
import { 
  MarketAnalysis, 
  PricePrediction, 
  SentimentScore, 
  ArbitrageOpportunity,
  MarketData,
  TaskData
} from './types.js'

export interface MarketIntelligenceConfig {
  provider: ethers.JsonRpcProvider
  contracts: {
    commitRegistry: string
    escrowManager: string
    ammEngine: string
    reputationManager: string
    agentRegistry: string
  }
}

export class MarketIntelligence {
  private provider: ethers.JsonRpcProvider
  private contracts: any
  private marketCache: Map<number, MarketAnalysis> = new Map()
  private priceHistory: Map<number, number[]> = new Map()
  private sentimentHistory: Map<number, SentimentScore[]> = new Map()

  constructor(config: MarketIntelligenceConfig) {
    this.provider = config.provider
    this.contracts = config.contracts
  }

  /**
   * Analyze market conditions for a specific market
   */
  async analyzeMarketConditions(marketId: number): Promise<MarketAnalysis> {
    // Check cache first
    if (this.marketCache.has(marketId)) {
      const cached = this.marketCache.get(marketId)!
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached
      }
    }

    try {
      // Get market data from AMM
      const ammContract = new ethers.Contract(
        this.contracts.ammEngine,
        ['function getMarket(uint256) view returns (tuple(uint256,address,address,uint256,uint256,uint256,bool,uint256))'],
        this.provider
      )

      const market = await ammContract.getMarket(marketId)
      const marketData: MarketData = {
        marketId,
        reserveA: market.reserveA,
        reserveB: market.reserveB,
        totalSupply: market.totalSupply,
        volume24h: await this.getVolume24h(marketId),
        price: Number(market.reserveB) / Number(market.reserveA),
        volatility: await this.calculateVolatility(marketId),
        liquidity: Number(market.reserveA + market.reserveB),
        active: market.active
      }

      // Calculate market metrics
      const volatility = await this.calculateVolatility(marketId)
      const liquidity = Number(market.reserveA + market.reserveB)
      const sentiment = await this.analyzeSentimentForMarket(marketId)
      const trend = await this.determineTrend(marketId)

      const analysis: MarketAnalysis = {
        marketId,
        volatility,
        liquidity,
        sentiment: sentiment.score,
        trend,
        confidence: this.calculateConfidence(marketData),
        recommendations: this.generateRecommendations(marketData, volatility, sentiment),
        timestamp: Date.now()
      }

      // Cache the analysis
      this.marketCache.set(marketId, analysis)

      return analysis
    } catch (error) {
      console.error(`Error analyzing market ${marketId}:`, error)
      return {
        marketId,
        volatility: 0.2,
        liquidity: 0,
        sentiment: 0,
        trend: 'neutral',
        confidence: 0.3,
        recommendations: ['Market data unavailable'],
        timestamp: Date.now()
      }
    }
  }

  /**
   * Predict price movement for a market
   */
  async predictPriceMovement(marketId: number): Promise<PricePrediction> {
    try {
      // Get historical prices
      const prices = await this.getHistoricalPrices(marketId)
      
      if (prices.length < 2) {
        return {
          marketId,
          currentPrice: prices[0] || 1,
          predictedPrice: prices[0] || 1,
          confidence: 0.3,
          timeframe: 3600,
          factors: ['Insufficient data']
        }
      }

      // Simple linear regression for price prediction
      const currentPrice = prices[prices.length - 1]
      const trend = this.calculateTrend(prices)
      const volatility = this.calculateVolatilityFromPrices(prices)
      
      // Predict next price
      const predictedPrice = currentPrice * (1 + trend)
      const confidence = Math.max(0.3, Math.min(0.9, 1 - volatility))

      const factors = []
      if (trend > 0.01) factors.push('Upward trend detected')
      if (trend < -0.01) factors.push('Downward trend detected')
      if (volatility > 0.3) factors.push('High volatility')
      if (volatility < 0.1) factors.push('Low volatility')

      return {
        marketId,
        currentPrice,
        predictedPrice,
        confidence,
        timeframe: 3600,
        factors
      }
    } catch (error) {
      console.error(`Error predicting price for market ${marketId}:`, error)
      return {
        marketId,
        currentPrice: 1,
        predictedPrice: 1,
        confidence: 0.3,
        timeframe: 3600,
        factors: ['Prediction error']
      }
    }
  }

  /**
   * Calculate market volatility
   */
  async calculateVolatility(marketId: number): Promise<number> {
    try {
      const prices = await this.getHistoricalPrices(marketId)
      
      if (prices.length < 2) return 0.2 // Default volatility

      // Calculate returns
      const returns = []
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1])
      }

      // Calculate standard deviation of returns
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
      const volatility = Math.sqrt(variance)

      return Math.max(0.01, Math.min(1.0, volatility))
    } catch (error) {
      console.error(`Error calculating volatility for market ${marketId}:`, error)
      return 0.2
    }
  }

  /**
   * Analyze sentiment based on task history
   */
  async analyzeSentiment(taskHistory: TaskData[]): Promise<SentimentScore> {
    if (taskHistory.length === 0) {
      return {
        score: 0,
        confidence: 0.3,
        factors: ['No data'],
        trend: 'stable'
      }
    }

    // Analyze validation scores
    const validationScores = taskHistory.map(task => task.reputation)
    const avgScore = validationScores.reduce((a, b) => a + b, 0) / validationScores.length

    // Analyze dispute rate
    const disputes = taskHistory.filter(task => task.reputation < 50).length
    const disputeRate = disputes / taskHistory.length

    // Calculate sentiment score (-1 to 1)
    const score = (avgScore - 50) / 50 // Normalize to -1 to 1
    const confidence = Math.max(0.3, 1 - disputeRate)

    const factors = []
    if (avgScore > 70) factors.push('High quality tasks')
    if (avgScore < 30) factors.push('Low quality tasks')
    if (disputeRate > 0.2) factors.push('High dispute rate')
    if (disputeRate < 0.05) factors.push('Low dispute rate')

    const trend = avgScore > 60 ? 'improving' : avgScore < 40 ? 'declining' : 'stable'

    return {
      score,
      confidence,
      factors,
      trend
    }
  }

  /**
   * Detect arbitrage opportunities between markets
   */
  async detectArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    try {
      const markets = [1, 2, 3] // Known market IDs
      const marketData: MarketData[] = []

      // Get data for all markets
      for (const marketId of markets) {
        const analysis = await this.analyzeMarketConditions(marketId)
        const ammContract = new ethers.Contract(
          this.contracts.ammEngine,
          ['function getMarket(uint256) view returns (tuple(uint256,address,address,uint256,uint256,uint256,bool,uint256))'],
          this.provider
        )
        const market = await ammContract.getMarket(marketId)
        
        marketData.push({
          marketId,
          reserveA: market.reserveA,
          reserveB: market.reserveB,
          totalSupply: market.totalSupply,
          volume24h: 0n,
          price: Number(market.reserveB) / Number(market.reserveA),
          volatility: analysis.volatility,
          liquidity: analysis.liquidity,
          active: market.active
        })
      }

      const opportunities: ArbitrageOpportunity[] = []

      // Find price differences
      for (let i = 0; i < marketData.length; i++) {
        for (let j = i + 1; j < marketData.length; j++) {
          const market1 = marketData[i]
          const market2 = marketData[j]

          const priceDiff = Math.abs(market1.price - market2.price) / Math.min(market1.price, market2.price)

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
    } catch (error) {
      console.error('Error detecting arbitrage opportunities:', error)
      return []
    }
  }

  // Helper methods

  private async getVolume24h(marketId: number): Promise<bigint> {
    // Simplified - would query events for actual volume
    return BigInt(Math.floor(Math.random() * 1000000))
  }

  private async getHistoricalPrices(marketId: number): Promise<number[]> {
    // Get price history from cache or calculate from reserves
    if (this.priceHistory.has(marketId)) {
      return this.priceHistory.get(marketId)!
    }

    // Generate synthetic price history for now
    const prices = [1.0]
    for (let i = 1; i < 24; i++) {
      const change = (Math.random() - 0.5) * 0.1 // ±5% change
      prices.push(prices[i-1] * (1 + change))
    }

    this.priceHistory.set(marketId, prices)
    return prices
  }

  private calculateTrend(prices: number[]): number {
    if (prices.length < 2) return 0

    const firstPrice = prices[0]
    const lastPrice = prices[prices.length - 1]
    return (lastPrice - firstPrice) / firstPrice
  }

  private calculateVolatilityFromPrices(prices: number[]): number {
    if (prices.length < 2) return 0.2

    const returns = []
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1])
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
    return Math.sqrt(variance)
  }

  private async analyzeSentimentForMarket(marketId: number): Promise<SentimentScore> {
    // Simplified sentiment analysis
    const volatility = await this.calculateVolatility(marketId)
    const liquidity = await this.getMarketLiquidity(marketId)

    let score = 0.5 // Neutral
    if (volatility < 0.2) score += 0.2 // Low volatility is good
    if (liquidity > 10000) score += 0.2 // High liquidity is good
    if (volatility > 0.5) score -= 0.3 // High volatility is bad

    return {
      score: Math.max(-1, Math.min(1, score)),
      confidence: 0.7,
      factors: [`Volatility: ${volatility.toFixed(2)}`, `Liquidity: ${liquidity}`],
      trend: score > 0.6 ? 'improving' : score < 0.4 ? 'declining' : 'stable'
    }
  }

  private async getMarketLiquidity(marketId: number): Promise<number> {
    try {
      const ammContract = new ethers.Contract(
        this.contracts.ammEngine,
        ['function getMarket(uint256) view returns (tuple(uint256,address,address,uint256,uint256,uint256,bool,uint256))'],
        this.provider
      )
      const market = await ammContract.getMarket(marketId)
      return Number(market.reserveA + market.reserveB)
    } catch (error) {
      return 0
    }
  }

  private async determineTrend(marketId: number): Promise<'bullish' | 'bearish' | 'neutral'> {
    const prices = await this.getHistoricalPrices(marketId)
    const trend = this.calculateTrend(prices)

    if (trend > 0.05) return 'bullish'
    if (trend < -0.05) return 'bearish'
    return 'neutral'
  }

  private calculateConfidence(marketData: MarketData): number {
    let confidence = 0.5

    // More data = higher confidence
    if (marketData.liquidity > 10000) confidence += 0.2
    if (marketData.volatility < 0.3) confidence += 0.1
    if (marketData.active) confidence += 0.2

    return Math.max(0.3, Math.min(0.9, confidence))
  }

  private generateRecommendations(marketData: MarketData, volatility: number, sentiment: SentimentScore): string[] {
    const recommendations = []

    if (volatility > 0.5) {
      recommendations.push('High volatility - consider risk management')
    }
    if (marketData.liquidity < 5000) {
      recommendations.push('Low liquidity - be cautious with large trades')
    }
    if (sentiment.score > 0.5) {
      recommendations.push('Positive sentiment - good for buying')
    }
    if (sentiment.score < -0.5) {
      recommendations.push('Negative sentiment - consider selling')
    }

    return recommendations
  }
}
