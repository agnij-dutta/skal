import { GoogleGenerativeAI } from '@google/generative-ai'
import { ethers } from 'ethers'
import { LocalMLModels } from './LocalMLModels.js'
import {
  TaskData,
  BuyDecision,
  PricingStrategy,
  RiskAssessment,
  Strategy,
  MarketConditions,
  QualityAnalysis,
  TaskParams,
  IntelligentData,
  Decision,
  Outcome
} from './types.js'

export interface AIDecisionEngineConfig {
  geminiApiKey: string
  provider: ethers.JsonRpcProvider
  config: any
}

export class AIDecisionEngine {
  private geminiClient: GoogleGenerativeAI
  private localModels: LocalMLModels
  private decisionCache: Map<string, any> = new Map()
  private performanceHistory: Map<string, Outcome[]> = new Map()

  constructor(config: AIDecisionEngineConfig) {
    this.geminiClient = new GoogleGenerativeAI(config.geminiApiKey)
    this.localModels = new LocalMLModels()
  }

  /**
   * Analyze a task and determine if it should be bought
   */
  async analyzeTask(taskData: TaskData): Promise<BuyDecision> {
    const cacheKey = `task_${taskData.taskId}_${taskData.timestamp}`
    
    // Check cache first
    if (this.decisionCache.has(cacheKey)) {
      return this.decisionCache.get(cacheKey)
    }

    try {
      // Fast local screening first
      const quickScore = this.localModels.predictTaskQuality(taskData.features)
      if (quickScore < 0.3) {
        const decision: BuyDecision = {
          shouldBuy: false,
          confidence: 1 - quickScore,
          reason: 'Failed quick screening - low quality indicators',
          recommendedAmount: 0n,
          expectedReturn: 0,
          riskScore: 1 - quickScore
        }
        this.decisionCache.set(cacheKey, decision)
        return decision
      }

      // Use Gemini for complex analysis
      const prompt = this.buildTaskAnalysisPrompt(taskData)
      const geminiResponse = await this.analyzeWithGemini(prompt)
      const decision = this.parseGeminiBuyDecision(geminiResponse, taskData)

      // Cache the decision
      this.decisionCache.set(cacheKey, decision)
      
      // Track for learning
      this.trackDecision('task_analysis', taskData, decision)

      return decision
    } catch (error) {
      console.error('Error in analyzeTask:', error)
      // Fallback to local model
      return this.localModels.predictTaskQuality(taskData.features) > 0.5 
        ? { shouldBuy: true, confidence: 0.6, reason: 'Local model fallback', recommendedAmount: taskData.stake, expectedReturn: 0.1, riskScore: 0.4 }
        : { shouldBuy: false, confidence: 0.6, reason: 'Local model fallback - low confidence', recommendedAmount: 0n, expectedReturn: 0, riskScore: 0.6 }
    }
  }

  /**
   * Optimize pricing strategy for a market
   */
  async optimizePricing(marketData: any): Promise<PricingStrategy> {
    const prompt = `Analyze this market data and suggest optimal pricing strategy:
    Market ID: ${marketData.marketId}
    Reserve A: ${marketData.reserveA}
    Reserve B: ${marketData.reserveB}
    Volatility: ${marketData.volatility}
    Volume: ${marketData.volume24h}
    
    Suggest:
    1. Base price multiplier
    2. Volatility adjustment
    3. Demand factor
    4. Risk premium
    
    Return as JSON with pricing strategy.`

    try {
      const response = await this.analyzeWithGemini(prompt)
      return this.parsePricingStrategy(response)
    } catch (error) {
      console.error('Error optimizing pricing:', error)
      return {
        baseMultiplier: 1.0,
        volatilityAdjustment: 0.1,
        demandFactor: 1.0,
        riskPremium: 0.05
      }
    }
  }

  /**
   * Calculate risk for a position
   */
  async calculateRisk(position: any): Promise<RiskAssessment> {
    const factors: any[] = []
    let totalRisk = 0

    // Market volatility risk
    if (position.volatility > 0.3) {
      factors.push({ name: 'High Volatility', impact: 0.3, description: 'Market shows high volatility' })
      totalRisk += 0.3
    }

    // Concentration risk
    if (position.allocation > 0.5) {
      factors.push({ name: 'High Concentration', impact: 0.2, description: 'Position represents large portion of portfolio' })
      totalRisk += 0.2
    }

    // Liquidity risk
    if (position.liquidity < 1000) {
      factors.push({ name: 'Low Liquidity', impact: 0.25, description: 'Market has low liquidity' })
      totalRisk += 0.25
    }

    return {
      score: Math.min(totalRisk, 1.0),
      factors,
      recommendation: totalRisk > 0.7 ? 'skip' : totalRisk > 0.4 ? 'reduce' : 'buy',
      maxStake: totalRisk > 0.7 ? 0n : BigInt(Math.floor(Number(position.balance) * (1 - totalRisk)))
    }
  }

  /**
   * Select optimal strategy based on market conditions
   */
  async selectStrategy(conditions: MarketConditions): Promise<Strategy> {
    const prompt = `Analyze these market conditions and suggest trading strategy:
    Markets: ${JSON.stringify(conditions.markets)}
    Global Sentiment: ${conditions.globalSentiment.score}
    Volatility: ${conditions.volatility}
    Liquidity: ${conditions.liquidity}
    
    Suggest:
    1. Strategy type (conservative/aggressive/balanced)
    2. Specific actions to take
    3. Expected return
    4. Risk level
    5. Timeframe
    
    Return as JSON strategy.`

    try {
      const response = await this.analyzeWithGemini(prompt)
      return this.parseStrategy(response)
    } catch (error) {
      console.error('Error selecting strategy:', error)
      return {
        type: 'balanced',
        actions: [],
        expectedReturn: 0.1,
        riskLevel: 0.5,
        timeframe: 3600
      }
    }
  }

  /**
   * Analyze data quality for verification
   */
  async analyzeDataQuality(data: { data: string; cid: string; taskId: number; expectedType: string }): Promise<QualityAnalysis> {
    const prompt = `Analyze this trading signal data for quality:
    Data: ${data.data}
    Task ID: ${data.taskId}
    Expected Type: ${data.expectedType}
    
    Evaluate:
    1. Data completeness (0-100)
    2. Accuracy indicators (0-100)
    3. Relevance to market (0-100)
    4. Structure quality (0-100)
    
    Return JSON with scores and reasoning.`

    try {
      const response = await this.analyzeWithGemini(prompt)
      return this.parseQualityAnalysis(response)
    } catch (error) {
      console.error('Error analyzing data quality:', error)
      return {
        score: 50,
        factors: {
          completeness: 50,
          accuracy: 50,
          relevance: 50,
          structure: 50
        },
        reasoning: 'Fallback analysis due to API error'
      }
    }
  }

  /**
   * Optimize task creation parameters
   */
  async optimizeTaskCreation(params: any): Promise<TaskParams> {
    const prompt = `Optimize task creation parameters:
    Market Demand: ${params.marketDemand}
    Current Reputation: ${params.currentReputation}
    Competition: ${params.competitorAnalysis}
    Historical Performance: ${params.historicalPerformance}
    
    Suggest optimal:
    1. Market ID
    2. Market type
    3. Target quality
    4. Data type
    5. Competition level
    
    Return as JSON.`

    try {
      const response = await this.analyzeWithGemini(prompt)
      return this.parseTaskParams(response)
    } catch (error) {
      console.error('Error optimizing task creation:', error)
      return {
        marketId: 1,
        marketType: 'trading_signal',
        targetQuality: 0.8,
        dataType: 'prediction',
        marketConditions: {},
        competitionLevel: 0.5
      }
    }
  }

  /**
   * Generate intelligent data using Gemini
   */
  async generateWithGemini(prompt: string): Promise<string> {
    try {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' })
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Gemini API error:', error)
      throw error
    }
  }

  /**
   * Analyze with Gemini (wrapper for consistency)
   */
  async analyzeWithGemini(prompt: string): Promise<string> {
    return this.generateWithGemini(prompt)
  }

  /**
   * Track decision for learning
   */
  private trackDecision(type: string, input: any, output: any): void {
    const decision: Decision = {
      id: `${type}_${Date.now()}`,
      agentType: type,
      timestamp: Date.now(),
      input,
      output,
      confidence: output.confidence || 0.5,
      executed: false
    }

    // Store for later outcome tracking
    if (!this.performanceHistory.has(type)) {
      this.performanceHistory.set(type, [])
    }
  }

  /**
   * Record decision outcome for learning
   */
  async recordOutcome(decisionId: string, outcome: Outcome): Promise<void> {
    const outcomes = this.performanceHistory.get(decisionId.split('_')[0]) || []
    outcomes.push(outcome)
    this.performanceHistory.set(decisionId.split('_')[0], outcomes)
  }

  // Helper methods for parsing Gemini responses
  private buildTaskAnalysisPrompt(taskData: TaskData): string {
    return `Analyze this trading task opportunity:
    Task ID: ${taskData.taskId}
    Provider: ${taskData.provider}
    Stake: ${ethers.formatEther(taskData.stake)} STT
    Market ID: ${taskData.marketId}
    Provider Reputation: ${taskData.reputation}
    Market Data: ${JSON.stringify(taskData.marketData)}
    Provider History: ${JSON.stringify(taskData.providerHistory)}
    
    Determine:
    1. Should we buy this task? (true/false)
    2. Confidence level (0-1)
    3. Reason for decision
    4. Recommended buy amount
    5. Expected return (0-1)
    6. Risk score (0-1)
    
    Return as JSON.`
  }

  private parseGeminiBuyDecision(response: string, taskData: TaskData): BuyDecision {
    try {
      const parsed = JSON.parse(response)
      return {
        shouldBuy: parsed.shouldBuy || false,
        confidence: parsed.confidence || 0.5,
        reason: parsed.reason || 'AI analysis',
        recommendedAmount: parsed.recommendedAmount ? BigInt(parsed.recommendedAmount) : taskData.stake,
        expectedReturn: parsed.expectedReturn || 0.1,
        riskScore: parsed.riskScore || 0.5
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error)
      return {
        shouldBuy: false,
        confidence: 0.3,
        reason: 'Failed to parse AI response',
        recommendedAmount: 0n,
        expectedReturn: 0,
        riskScore: 0.7
      }
    }
  }

  private parsePricingStrategy(response: string): any {
    try {
      return JSON.parse(response)
    } catch (error) {
      return {
        baseMultiplier: 1.0,
        volatilityAdjustment: 0.1,
        demandFactor: 1.0,
        riskPremium: 0.05
      }
    }
  }

  private parseStrategy(response: string): Strategy {
    try {
      const parsed = JSON.parse(response)
      return {
        type: parsed.type || 'balanced',
        actions: parsed.actions || [],
        expectedReturn: parsed.expectedReturn || 0.1,
        riskLevel: parsed.riskLevel || 0.5,
        timeframe: parsed.timeframe || 3600
      }
    } catch (error) {
      return {
        type: 'balanced',
        actions: [],
        expectedReturn: 0.1,
        riskLevel: 0.5,
        timeframe: 3600
      }
    }
  }

  private parseQualityAnalysis(response: string): QualityAnalysis {
    try {
      const parsed = JSON.parse(response)
      return {
        score: parsed.score || 50,
        factors: {
          completeness: parsed.completeness || 50,
          accuracy: parsed.accuracy || 50,
          relevance: parsed.relevance || 50,
          structure: parsed.structure || 50
        },
        reasoning: parsed.reasoning || 'AI analysis'
      }
    } catch (error) {
      return {
        score: 50,
        factors: {
          completeness: 50,
          accuracy: 50,
          relevance: 50,
          structure: 50
        },
        reasoning: 'Fallback analysis'
      }
    }
  }

  private parseTaskParams(response: string): TaskParams {
    try {
      const parsed = JSON.parse(response)
      return {
        marketId: parsed.marketId || 1,
        marketType: parsed.marketType || 'trading_signal',
        targetQuality: parsed.targetQuality || 0.8,
        dataType: parsed.dataType || 'prediction',
        marketConditions: parsed.marketConditions || {},
        competitionLevel: parsed.competitionLevel || 0.5
      }
    } catch (error) {
      return {
        marketId: 1,
        marketType: 'trading_signal',
        targetQuality: 0.8,
        dataType: 'prediction',
        marketConditions: {},
        competitionLevel: 0.5
      }
    }
  }
}
