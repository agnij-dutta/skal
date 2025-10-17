import { 
  Decision, 
  Outcome, 
  PerformanceMetrics, 
  OptimizedParams,
  Report
} from './types.js'
import { AIDecisionEngine } from './AIDecisionEngine.js'

export interface PerformanceMonitorConfig {
  aiEngine: AIDecisionEngine
  trackingInterval?: number
  reportInterval?: number
}

export class PerformanceMonitor {
  private aiEngine: AIDecisionEngine
  private decisions: Map<string, Decision> = new Map()
  private outcomes: Map<string, Outcome[]> = new Map()
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map()
  private trackingInterval: number
  private reportInterval: number
  private isMonitoring: boolean = false
  private monitoringTimer?: NodeJS.Timeout
  private reportTimer?: NodeJS.Timeout

  constructor(config: PerformanceMonitorConfig) {
    this.aiEngine = config.aiEngine
    this.trackingInterval = config.trackingInterval || 60000 // 1 minute
    this.reportInterval = config.reportInterval || 300000 // 5 minutes
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    console.log('📊 Starting performance monitoring...')

    // Start tracking timer
    this.monitoringTimer = setInterval(() => {
      this.updatePerformanceMetrics()
    }, this.trackingInterval)

    // Start report timer
    this.reportTimer = setInterval(() => {
      this.generatePerformanceReport()
    }, this.reportInterval)
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    console.log('📊 Stopping performance monitoring...')

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
      this.monitoringTimer = undefined
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer)
      this.reportTimer = undefined
    }
  }

  /**
   * Track a decision for later outcome analysis
   */
  async trackDecisionOutcome(decision: Decision, outcome: Outcome): Promise<void> {
    // Store the decision
    this.decisions.set(decision.id, decision)

    // Store the outcome
    if (!this.outcomes.has(decision.id)) {
      this.outcomes.set(decision.id, [])
    }
    this.outcomes.get(decision.id)!.push(outcome)

    // Update AI engine with outcome for learning
    await this.aiEngine.recordOutcome(decision.id, outcome)

    console.log(`📈 Tracked outcome for decision ${decision.id}: ${outcome.success ? 'SUCCESS' : 'FAILURE'}`)
  }

  /**
   * Calculate performance metrics for an agent type
   */
  async calculateAgentPerformance(agentType: string): Promise<PerformanceMetrics> {
    const agentDecisions = Array.from(this.decisions.values()).filter(d => d.agentType === agentType)
    const agentOutcomes = Array.from(this.outcomes.values()).flat().filter(o => 
      agentDecisions.some(d => d.id === o.decisionId)
    )

    if (agentDecisions.length === 0) {
      return this.getEmptyMetrics(agentType)
    }

    const totalDecisions = agentDecisions.length
    const successfulDecisions = agentOutcomes.filter(o => o.success).length
    const winRate = successfulDecisions / totalDecisions

    const returns = agentOutcomes.map(o => o.actualReturn)
    const averageReturn = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) / returns.length : 0
    const totalReturn = returns.reduce((sum, ret) => sum + ret, 0)

    // Calculate risk-adjusted return (Sharpe ratio)
    const riskFreeRate = 0.02 // 2% annual risk-free rate
    const volatility = this.calculateVolatility(returns)
    const sharpeRatio = volatility > 0 ? (averageReturn - riskFreeRate) / volatility : 0

    // Calculate maximum drawdown
    const maxDrawdown = this.calculateMaxDrawdown(returns)

    const metrics: PerformanceMetrics = {
      agentType,
      totalDecisions,
      successfulDecisions,
      winRate,
      averageReturn,
      totalReturn,
      riskAdjustedReturn: sharpeRatio,
      sharpeRatio,
      maxDrawdown,
      lastUpdated: Date.now()
    }

    // Store in history
    if (!this.performanceHistory.has(agentType)) {
      this.performanceHistory.set(agentType, [])
    }
    this.performanceHistory.get(agentType)!.push(metrics)

    return metrics
  }

  /**
   * Optimize parameters based on performance
   */
  async optimizeParameters(agent: string): Promise<OptimizedParams> {
    const metrics = await this.calculateAgentPerformance(agent)
    
    // Analyze performance patterns
    const recentMetrics = this.performanceHistory.get(agent)?.slice(-10) || []
    
    // Calculate optimal parameters based on performance
    const confidenceThreshold = this.calculateOptimalConfidenceThreshold(metrics, recentMetrics)
    const riskTolerance = this.calculateOptimalRiskTolerance(metrics, recentMetrics)
    const maxStakePercentage = this.calculateOptimalMaxStake(metrics, recentMetrics)
    const rebalanceInterval = this.calculateOptimalRebalanceInterval(metrics, recentMetrics)
    const stopLossPercentage = this.calculateOptimalStopLoss(metrics, recentMetrics)

    return {
      confidenceThreshold,
      riskTolerance,
      maxStakePercentage,
      rebalanceInterval,
      stopLossPercentage
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(): Promise<Report> {
    const agentTypes = ['buyer', 'lp', 'provider', 'verifier']
    const metrics: PerformanceMetrics[] = []
    const recommendations: string[] = []
    const alerts: string[] = []

    // Calculate metrics for each agent type
    for (const agentType of agentTypes) {
      const agentMetrics = await this.calculateAgentPerformance(agentType)
      metrics.push(agentMetrics)

      // Generate recommendations
      if (agentMetrics.winRate < 0.6) {
        recommendations.push(`${agentType} agent: Improve decision quality - win rate ${(agentMetrics.winRate * 100).toFixed(1)}%`)
      }
      if (agentMetrics.sharpeRatio < 0.5) {
        recommendations.push(`${agentType} agent: Optimize risk-return ratio - Sharpe ratio ${agentMetrics.sharpeRatio.toFixed(2)}`)
      }
      if (agentMetrics.maxDrawdown > 0.2) {
        alerts.push(`${agentType} agent: High drawdown detected - ${(agentMetrics.maxDrawdown * 100).toFixed(1)}%`)
      }
    }

    const report: Report = {
      period: this.getReportPeriod(),
      metrics: metrics[0], // Use first agent as overall metrics
      recommendations,
      alerts,
      generatedAt: Date.now()
    }

    console.log('📊 Performance Report Generated:', {
      period: report.period,
      recommendations: report.recommendations.length,
      alerts: report.alerts.length
    })

    return report
  }

  // Private helper methods

  private async updatePerformanceMetrics(): Promise<void> {
    const agentTypes = ['buyer', 'lp', 'provider', 'verifier']
    
    for (const agentType of agentTypes) {
      await this.calculateAgentPerformance(agentType)
    }
  }

  private getEmptyMetrics(agentType: string): PerformanceMetrics {
    return {
      agentType,
      totalDecisions: 0,
      successfulDecisions: 0,
      winRate: 0,
      averageReturn: 0,
      totalReturn: 0,
      riskAdjustedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      lastUpdated: Date.now()
    }
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length
    return Math.sqrt(variance)
  }

  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0

    let maxDrawdown = 0
    let peak = returns[0]

    for (const ret of returns) {
      if (ret > peak) {
        peak = ret
      }
      const drawdown = (peak - ret) / peak
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    return maxDrawdown
  }

  private calculateOptimalConfidenceThreshold(metrics: PerformanceMetrics, history: PerformanceMetrics[]): number {
    // If win rate is high, we can be more confident
    // If win rate is low, we need higher confidence threshold
    const baseThreshold = 0.7
    const winRateAdjustment = (metrics.winRate - 0.5) * 0.2
    return Math.max(0.5, Math.min(0.9, baseThreshold + winRateAdjustment))
  }

  private calculateOptimalRiskTolerance(metrics: PerformanceMetrics, history: PerformanceMetrics[]): number {
    // If Sharpe ratio is good, we can take more risk
    // If Sharpe ratio is poor, we need to be more conservative
    const baseTolerance = 0.6
    const sharpeAdjustment = (metrics.sharpeRatio - 0.5) * 0.2
    return Math.max(0.3, Math.min(0.8, baseTolerance + sharpeAdjustment))
  }

  private calculateOptimalMaxStake(metrics: PerformanceMetrics, history: PerformanceMetrics[]): number {
    // If performance is good, we can stake more
    // If performance is poor, we need to stake less
    const baseStake = 0.1
    const performanceAdjustment = (metrics.winRate - 0.5) * 0.1
    return Math.max(0.05, Math.min(0.25, baseStake + performanceAdjustment))
  }

  private calculateOptimalRebalanceInterval(metrics: PerformanceMetrics, history: PerformanceMetrics[]): number {
    // If volatility is high, rebalance more frequently
    // If volatility is low, rebalance less frequently
    const baseInterval = 300000 // 5 minutes
    const volatilityFactor = metrics.maxDrawdown > 0.1 ? 0.5 : 1.0
    return Math.floor(baseInterval * volatilityFactor)
  }

  private calculateOptimalStopLoss(metrics: PerformanceMetrics, history: PerformanceMetrics[]): number {
    // If drawdown is high, use tighter stop loss
    // If drawdown is low, use looser stop loss
    const baseStopLoss = 0.1
    const drawdownAdjustment = metrics.maxDrawdown * 0.5
    return Math.max(0.05, Math.min(0.2, baseStopLoss + drawdownAdjustment))
  }

  private getReportPeriod(): string {
    const now = new Date()
    const start = new Date(now.getTime() - this.reportInterval)
    return `${start.toISOString()} to ${now.toISOString()}`
  }
}
