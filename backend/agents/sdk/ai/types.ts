// AI System Types and Interfaces

export interface TaskData {
  taskId: number
  provider: string
  stake: bigint
  marketId: number
  reputation: number
  marketData: MarketData
  providerHistory: ProviderHistory
  timestamp: number
  features: TaskFeatures
}

export interface TaskFeatures {
  stakeAmount: number
  providerReputation: number
  marketVolatility: number
  timeSinceCommit: number
  marketLiquidity: number
  competitionLevel: number
  historicalSuccessRate: number
}

export interface MarketData {
  marketId: number
  reserveA: bigint
  reserveB: bigint
  totalSupply: bigint
  volume24h: bigint
  price: number
  volatility: number
  liquidity: number
  active: boolean
}

export interface MarketAnalysis {
  marketId: number
  volatility: number
  liquidity: number
  sentiment: number
  trend: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  recommendations: string[]
}

export interface PricePrediction {
  marketId: number
  currentPrice: number
  predictedPrice: number
  confidence: number
  timeframe: number
  factors: string[]
}

export interface BuyDecision {
  shouldBuy: boolean
  confidence: number
  reason: string
  recommendedAmount: bigint
  expectedReturn: number
  riskScore: number
}

export interface RiskAssessment {
  score: number // 0-1, lower is better
  factors: RiskFactor[]
  recommendation: 'buy' | 'skip' | 'reduce'
  maxStake: bigint
}

export interface RiskFactor {
  name: string
  impact: number
  description: string
}

export interface Strategy {
  type: 'conservative' | 'aggressive' | 'balanced'
  actions: StrategyAction[]
  expectedReturn: number
  riskLevel: number
  timeframe: number
}

export interface StrategyAction {
  type: 'add' | 'remove' | 'rebalance' | 'trade'
  marketId: number
  amounts?: { amountA: bigint; amountB: bigint }
  lpTokens?: bigint
  from?: number
  to?: number
  amount?: bigint
}

export interface PricingModel {
  marketId: number
  basePrice: number
  volatilityMultiplier: number
  demandFactor: number
  reputationBonus: number
  lastUpdate: number
}

export interface PerformanceMetrics {
  agentType: string
  totalDecisions: number
  successfulDecisions: number
  winRate: number
  averageReturn: number
  totalReturn: number
  riskAdjustedReturn: number
  sharpeRatio: number
  maxDrawdown: number
  lastUpdated: number
}

export interface Decision {
  id: string
  agentType: string
  timestamp: number
  input: any
  output: any
  confidence: number
  executed: boolean
}

export interface Outcome {
  decisionId: string
  success: boolean
  actualReturn: number
  timestamp: number
  notes?: string
}

export interface ArbitrageOpportunity {
  fromMarket: number
  toMarket: number
  expectedProfit: number
  estimatedCost: number
  confidence: number
  timeframe: number
}

export interface QualityAnalysis {
  score: number
  factors: {
    completeness: number
    accuracy: number
    relevance: number
    structure: number
  }
  reasoning: string
}

export interface ProviderHistory {
  totalTasks: number
  successfulTasks: number
  averageScore: number
  disputes: number
  lastActivity: number
}

export interface LiquidityRatio {
  amountA: bigint
  amountB: bigint
  ratio: number
  expectedReturn: number
}

export interface Reserves {
  reserveA: bigint
  reserveB: bigint
  totalSupply: bigint
}

export interface Position {
  marketId: number
  lpTokens: bigint
  value: bigint
  entryPrice: number
  currentPrice: number
  pnl: number
}

export interface PortfolioRisk {
  totalValue: bigint
  maxDrawdown: number
  var95: number
  concentration: number
  correlation: number
}

export interface HedgeDecision {
  shouldHedge: boolean
  hedgeAmount: bigint
  hedgeType: 'liquidity' | 'position'
  confidence: number
}

export interface StopLossLevel {
  price: number
  percentage: number
  absolute: bigint
  triggered: boolean
}

export interface ExecutionResult {
  success: boolean
  transactionHash?: string
  actualAmount?: bigint
  slippage?: number
  gasUsed?: bigint
  error?: string
}

export interface OptimizedTrades {
  trades: Trade[]
  totalValue: bigint
  expectedSlippage: number
  gasEstimate: bigint
}

export interface Trade {
  type: 'buy' | 'sell' | 'add' | 'remove'
  marketId: number
  amount: bigint
  expectedPrice: bigint
  maxSlippage: number
}

export interface PortfolioTarget {
  markets: { marketId: number; targetAllocation: number }[]
  totalValue: bigint
  rebalanceThreshold: number
}

export interface SentimentScore {
  score: number // -1 to 1
  confidence: number
  factors: string[]
  trend: 'improving' | 'declining' | 'stable'
}

export interface MarketConditions {
  markets: MarketAnalysis[]
  globalSentiment: SentimentScore
  volatility: number
  liquidity: number
  timestamp: number
}

export interface TaskParams {
  marketId: number
  marketType: string
  targetQuality: number
  dataType: string
  marketConditions: any
  competitionLevel: number
}

export interface IntelligentData {
  data: string
  qualityScore: number
  metadata: TaskParams
}

export interface OptimizedParams {
  confidenceThreshold: number
  riskTolerance: number
  maxStakePercentage: number
  rebalanceInterval: number
  stopLossPercentage: number
}

export interface Report {
  period: string
  metrics: PerformanceMetrics
  recommendations: string[]
  alerts: string[]
  generatedAt: number
}
