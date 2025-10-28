import { ethers } from 'ethers'
import { 
  TaskData, 
  RiskAssessment, 
  RiskFactor, 
  Position, 
  PortfolioRisk,
  HedgeDecision,
  StopLossLevel
} from './types.js'
import { AIDecisionEngine } from './AIDecisionEngine.js'
import { MarketIntelligence } from './MarketIntelligence.js'

export interface RiskManagerConfig {
  aiEngine: AIDecisionEngine
  marketIntelligence: MarketIntelligence
  maxPortfolioRisk?: number
  maxPositionSize?: number
  stopLossPercentage?: number
}

export class RiskManager {
  private aiEngine: AIDecisionEngine
  private marketIntelligence: MarketIntelligence
  private maxPortfolioRisk: number
  private maxPositionSize: number
  private stopLossPercentage: number
  private positionHistory: Map<string, Position[]> = new Map()

  constructor(config: RiskManagerConfig) {
    this.aiEngine = config.aiEngine
    this.marketIntelligence = config.marketIntelligence
    this.maxPortfolioRisk = config.maxPortfolioRisk || 0.3
    this.maxPositionSize = config.maxPositionSize || 0.2
    this.stopLossPercentage = config.stopLossPercentage || 0.1
  }

  /**
   * Assess risk for a specific task
   */
  async assessTaskRisk(task: TaskData): Promise<RiskAssessment> {
    const factors: RiskFactor[] = []
    let totalRisk = 0

    // Provider reputation risk
    const reputationRisk = this.calculateReputationRisk(task.reputation)
    factors.push({
      name: 'Provider Reputation',
      impact: reputationRisk,
      description: `Provider reputation: ${task.reputation}/100`
    })
    totalRisk += reputationRisk

    // Stake amount risk
    const stakeRisk = this.calculateStakeRisk(task.stake)
    factors.push({
      name: 'Stake Amount',
      impact: stakeRisk,
      description: `Stake amount: ${ethers.formatEther(task.stake)} STT`
    })
    totalRisk += stakeRisk

    // Market volatility risk
    const volatilityRisk = this.calculateVolatilityRisk(task.marketData.volatility)
    factors.push({
      name: 'Market Volatility',
      impact: volatilityRisk,
      description: `Market volatility: ${(task.marketData.volatility * 100).toFixed(1)}%`
    })
    totalRisk += volatilityRisk

    // Liquidity risk
    const liquidityRisk = this.calculateLiquidityRisk(task.marketData.liquidity)
    factors.push({
      name: 'Market Liquidity',
      impact: liquidityRisk,
      description: `Market liquidity: ${task.marketData.liquidity}`
    })
    totalRisk += liquidityRisk

    // Competition risk
    const competitionRisk = this.calculateCompetitionRisk(task.features.competitionLevel)
    factors.push({
      name: 'Competition Level',
      impact: competitionRisk,
      description: `Competition level: ${(task.features.competitionLevel * 100).toFixed(1)}%`
    })
    totalRisk += competitionRisk

    // Time risk (how long since commit)
    const timeRisk = this.calculateTimeRisk(task.features.timeSinceCommit)
    factors.push({
      name: 'Time Since Commit',
      impact: timeRisk,
      description: `Time since commit: ${Math.floor(task.features.timeSinceCommit / 60000)} minutes`
    })
    totalRisk += timeRisk

    // Normalize risk score
    const normalizedRisk = Math.min(1, totalRisk / 6) // Average of all factors

    return {
      score: normalizedRisk,
      factors,
      recommendation: this.getRiskRecommendation(normalizedRisk),
      maxStake: this.calculateMaxStake(task, normalizedRisk)
    }
  }

  /**
   * Calculate portfolio risk across all positions
   */
  async calculatePositionRisk(positions: Position[]): Promise<PortfolioRisk> {
    if (positions.length === 0) {
      return {
        totalValue: 0n,
        maxDrawdown: 0,
        var95: 0,
        concentration: 0,
        correlation: 0
      }
    }

    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0n)
    const maxValue = positions.reduce((max, pos) => pos.value > max ? pos.value : max, 0n)
    const concentration = Number(maxValue) / Number(totalValue)

    // Calculate portfolio volatility (simplified)
    const returns = positions.map(pos => pos.pnl / Number(pos.value))
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    const volatility = Math.sqrt(variance)

    // Calculate VaR (Value at Risk) - 95% confidence
    const sortedReturns = returns.sort((a, b) => a - b)
    const var95Index = Math.floor(sortedReturns.length * 0.05)
    const var95 = sortedReturns[var95Index] || 0

    // Calculate correlation (simplified)
    const correlation = this.calculateCorrelation(positions)

    return {
      totalValue,
      maxDrawdown: Math.max(0, -Math.min(...returns)),
      var95,
      concentration,
      correlation
    }
  }

  /**
   * Determine optimal stake size for a task
   */
  async determineOptimalStakeSize(task: TaskData, balance: bigint): Promise<bigint> {
    const riskAssessment = await this.assessTaskRisk(task)
    
    // Base stake on risk score and available balance
    const riskMultiplier = 1 - riskAssessment.score
    const maxStakeFromRisk = BigInt(Math.floor(Number(balance) * this.maxPositionSize * riskMultiplier))
    
    // Don't exceed the task's stake amount
    const maxStakeFromTask = task.stake
    
    // Use the smaller of the two
    const optimalStake = maxStakeFromRisk < maxStakeFromTask ? maxStakeFromRisk : maxStakeFromTask
    
    // Ensure minimum viable stake
    const minStake = ethers.parseEther('0.001')
    return optimalStake > minStake ? optimalStake : 0n
  }

  /**
   * Determine if a position should be hedged
   */
  async shouldHedgePosition(position: Position): Promise<HedgeDecision> {
    const marketAnalysis = await this.marketIntelligence.analyzeMarketConditions(position.marketId)
    
    // High volatility = hedge
    if (marketAnalysis.volatility > 0.4) {
      return {
        shouldHedge: true,
        hedgeAmount: position.value / 2n, // Hedge 50%
        hedgeType: 'liquidity',
        confidence: 0.8
      }
    }

    // Large position = hedge
    if (Number(position.value) > 10000) {
      return {
        shouldHedge: true,
        hedgeAmount: position.value / 3n, // Hedge 33%
        hedgeType: 'position',
        confidence: 0.6
      }
    }

    return {
      shouldHedge: false,
      hedgeAmount: 0n,
      hedgeType: 'liquidity',
      confidence: 0.5
    }
  }

  /**
   * Set stop loss level for a position
   */
  async setStopLoss(position: Position): Promise<StopLossLevel> {
    const marketAnalysis = await this.marketIntelligence.analyzeMarketConditions(position.marketId)
    
    // More volatile markets = wider stop loss
    const volatilityMultiplier = 1 + marketAnalysis.volatility
    const stopLossPercent = this.stopLossPercentage * volatilityMultiplier
    
    const stopLossPrice = position.entryPrice * (1 - stopLossPercent)
    const stopLossAbsolute = BigInt(Math.floor(Number(position.value) * stopLossPercent))

    return {
      price: stopLossPrice,
      percentage: stopLossPercent,
      absolute: stopLossAbsolute,
      triggered: position.currentPrice <= stopLossPrice
    }
  }

  // Private helper methods

  private calculateReputationRisk(reputation: number): number {
    if (reputation >= 80) return 0.1
    if (reputation >= 60) return 0.2
    if (reputation >= 40) return 0.4
    if (reputation >= 20) return 0.6
    return 0.8
  }

  private calculateStakeRisk(stake: bigint): number {
    const stakeInEth = Number(ethers.formatEther(stake))
    
    if (stakeInEth <= 0.01) return 0.1
    if (stakeInEth <= 0.05) return 0.2
    if (stakeInEth <= 0.1) return 0.3
    if (stakeInEth <= 0.2) return 0.5
    return 0.7
  }

  private calculateVolatilityRisk(volatility: number): number {
    if (volatility <= 0.1) return 0.1
    if (volatility <= 0.2) return 0.2
    if (volatility <= 0.3) return 0.3
    if (volatility <= 0.5) return 0.5
    return 0.7
  }

  private calculateLiquidityRisk(liquidity: number): number {
    if (liquidity >= 50000) return 0.1
    if (liquidity >= 20000) return 0.2
    if (liquidity >= 10000) return 0.3
    if (liquidity >= 5000) return 0.5
    return 0.8
  }

  private calculateCompetitionRisk(competition: number): number {
    if (competition <= 0.2) return 0.1
    if (competition <= 0.4) return 0.2
    if (competition <= 0.6) return 0.3
    if (competition <= 0.8) return 0.5
    return 0.7
  }

  private calculateTimeRisk(timeSinceCommit: number): number {
    const hoursSinceCommit = timeSinceCommit / (1000 * 60 * 60)
    
    if (hoursSinceCommit <= 1) return 0.1
    if (hoursSinceCommit <= 6) return 0.2
    if (hoursSinceCommit <= 12) return 0.3
    if (hoursSinceCommit <= 24) return 0.5
    return 0.7
  }

  private getRiskRecommendation(riskScore: number): 'buy' | 'skip' | 'reduce' {
    if (riskScore <= 0.3) return 'buy'
    if (riskScore <= 0.6) return 'reduce'
    return 'skip'
  }

  private calculateMaxStake(task: TaskData, riskScore: number): bigint {
    const baseStake = task.stake
    const riskMultiplier = 1 - riskScore
    return BigInt(Math.floor(Number(baseStake) * riskMultiplier))
  }

  private calculateCorrelation(positions: Position[]): number {
    if (positions.length < 2) return 0

    // Simplified correlation calculation
    const returns = positions.map(pos => pos.pnl / Number(pos.value))
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    
    // Calculate correlation coefficient (simplified)
    const numerator = returns.reduce((sum, ret) => sum + (ret - avgReturn) * (ret - avgReturn), 0)
    const denominator = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0)
    
    return denominator > 0 ? numerator / denominator : 0
  }
}
