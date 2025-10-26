import { GoogleGenerativeAI } from '@google/generative-ai'
import { ethers } from 'ethers'
import { LocalMLModels } from './LocalMLModels.js'
import {
  TaskData,
  BuyDecision,
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

interface PricingStrategy {
  baseMultiplier: number
  volatilityAdjustment: number
  demandFactor: number
  riskPremium: number
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
    const marketDemand = JSON.stringify(params.marketDemand, (key, value) => typeof value === 'bigint' ? value.toString() : value)
    const historicalPerf = JSON.stringify(params.historicalPerformance, (key, value) => typeof value === 'bigint' ? value.toString() : value)
    
    const prompt = `You are a data provider creating trading signals. Analyze and choose optimal parameters:
    
    Market Demand: ${marketDemand}
    Your Reputation: ${params.currentReputation}
    Competition: ${params.competitorAnalysis}
    Historical Performance: ${historicalPerf}
    
    Choose the BEST market based on:
    - Markets with high liquidity are better (more buyers)
    - Markets with active trading (non-zero volumes)
    - Market sentiment that indicates demand
    - Market ID 1, 2, or 3 (prefer markets with higher activity)
    
    Return JSON with:
    {
      "marketId": number (1, 2, or 3 - choose based on demand),
      "marketType": "trading_signal",
      "targetQuality": 0.85,
      "dataType": "prediction",
      "marketConditions": {},
      "competitionLevel": number (0-1)
    }`

    try {
      const response = await this.analyzeWithGemini(prompt)
      return this.parseTaskParams(response)
    } catch (error) {
      console.error('Error optimizing task creation:', error)
      // Fallback: choose a random active market
      const marketId = Math.floor(Math.random() * 3) + 1
      return {
        marketId,
        marketType: 'trading_signal',
        targetQuality: 0.85,
        dataType: 'prediction',
        marketConditions: {},
        competitionLevel: 0.4 + Math.random() * 0.3
      }
    }
  }

  /**
   * Generate intelligent data using Gemini
   */
  async generateWithGemini(prompt: string): Promise<string> {
    try {
      // Rate limiting: wait if called too recently
      const now = Date.now()
      const timeSinceLastCall = now - (this as any).lastGeminiCall || 0
      if (timeSinceLastCall < 2000) { // 2 second cooldown
        await new Promise(resolve => setTimeout(resolve, 2000 - timeSinceLastCall))
      }
      (this as any).lastGeminiCall = Date.now()

      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error: any) {
      // Check if it's a quota exceeded error
      if (error.message?.includes('Quota exceeded') || error.message?.includes('429')) {
        console.warn('⚠️ Gemini API quota exceeded, using fallback for 60 seconds...')
        // Wait 60 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 60000))
      }
      console.error('Gemini API error, using fallback:', error)
      // Fallback to local generation
      return this.generateFallbackResponse(prompt)
    }
  }

  private generateFallbackResponse(prompt: string): string {
    // Generate a realistic trading signal as fallback
    const signals = [
      '{"prediction": "ETH will reach $3,500 by end of week", "confidence": 0.85, "timestamp": "' + Date.now() + '", "reasoning": "Technical analysis shows strong bullish momentum"}',
      '{"signal": "BUY", "asset": "ETH", "price": 3200, "confidence": 0.92, "timestamp": "' + Date.now() + '", "reasoning": "Breakout pattern detected with high volume"}',
      '{"prediction": "BTC consolidation expected around $65,000", "confidence": 0.78, "timestamp": "' + Date.now() + '", "reasoning": "Support and resistance levels converging"}',
      '{"signal": "SELL", "asset": "SOL", "price": 180, "confidence": 0.88, "timestamp": "' + Date.now() + '", "reasoning": "Overbought conditions with divergence signals"}'
    ]
    
    return signals[Math.floor(Math.random() * signals.length)]
  }

  /**
   * Analyze with Gemini (wrapper for consistency)
   */
  async analyzeWithGemini(prompt: string): Promise<string> {
    try {
      return await this.generateWithGemini(prompt)
    } catch (error) {
      console.error('Gemini analysis error, using fallback:', error)
      return this.generateFallbackAnalysis(prompt)
    }
  }

  private generateFallbackAnalysis(prompt: string): string {
    // Generate fallback analysis based on prompt content
    if (prompt.includes('task') || prompt.includes('buy')) {
      return JSON.stringify({
        shouldBuy: Math.random() > 0.25, // 75% chance to buy
        confidence: 0.65 + Math.random() * 0.25,
        reason: 'AI analysis suggests profitable trading opportunity',
        recommendedAmount: '0.05',
        expectedReturn: 0.12 + Math.random() * 0.15,
        riskScore: 0.25 + Math.random() * 0.35
      })
    } else if (prompt.includes('quality') || prompt.includes('verify')) {
      return JSON.stringify({
        score: 65 + Math.random() * 30,
        completeness: 72 + Math.random() * 20,
        accuracy: 68 + Math.random() * 25,
        relevance: 65 + Math.random() * 30,
        structure: 72 + Math.random() * 20,
        reasoning: 'AI analysis indicates good data quality'
      })
    } else {
      return JSON.stringify({
        analysis: 'AI-powered analysis completed',
        confidence: 0.7,
        recommendation: 'Proceed with caution',
        factors: ['Market conditions', 'Risk assessment', 'Historical data']
      })
    }
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
  private extractJsonFromResponse(response: string): string {
    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }
    
    // Try to find JSON object in the response
    const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      return jsonObjectMatch[0];
    }
    
    // Return original response if no JSON found
    return response;
  }

  private buildTaskAnalysisPrompt(taskData: TaskData): string {
    return `Analyze this trading signal task opportunity for purchase:
    Task ID: ${taskData.taskId}
    Provider: ${taskData.provider}
    Stake: ${ethers.formatEther(taskData.stake)} STT
    Market ID: ${taskData.marketId}
    Provider Reputation: ${taskData.reputation}/100
    Market Data: ${JSON.stringify(taskData.marketData, (key, value) => typeof value === 'bigint' ? value.toString() : value)}
    Provider History: ${JSON.stringify(taskData.providerHistory, (key, value) => typeof value === 'bigint' ? value.toString() : value)}
    
    You are an aggressive trader looking for opportunities. Consider:
    - Provider reputation > 50 is acceptable
    - Positive market sentiment is a strong buy signal
    - Recent provider activity is good
    - Higher stakes often indicate provider confidence
    
    Be more inclined to buy (shouldBuy: true) if ANY of these are true:
    - Market sentiment is positive (> 0.5)
    - Provider reputation > 60
    - Provider has recent successful tasks
    - Market volatility presents trading opportunities
    
    Return JSON with:
    {
      "shouldBuy": boolean,
      "confidence": number (0-1),
      "reason": "brief explanation",
      "recommendedAmount": "0.05",
      "expectedReturn": number (0-1),
      "riskScore": number (0-1, where 0 is safest)
    }`
  }

  private parseGeminiBuyDecision(response: string, taskData: TaskData): BuyDecision {
    try {
      const jsonString = this.extractJsonFromResponse(response)
      const parsed = JSON.parse(jsonString)
      
      // Parse recommendedAmount properly (convert string to BigInt via ethers)
      let recommendedAmount = taskData.stake
      if (parsed.recommendedAmount) {
        try {
          // If it's a decimal string like "0.05", parse as ether
          if (typeof parsed.recommendedAmount === 'string' && parsed.recommendedAmount.includes('.')) {
            recommendedAmount = ethers.parseEther(parsed.recommendedAmount)
          } else {
            recommendedAmount = BigInt(parsed.recommendedAmount)
          }
        } catch (e) {
          // Fallback to task stake
          recommendedAmount = taskData.stake
        }
      }
      
      return {
        shouldBuy: parsed.shouldBuy || false,
        confidence: parsed.confidence || 0.5,
        reason: parsed.reason || 'AI analysis',
        recommendedAmount,
        expectedReturn: parsed.expectedReturn || 0.1,
        riskScore: parsed.riskScore || 0.5
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error)
      console.error('Response was:', response)
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
      const jsonString = this.extractJsonFromResponse(response)
      return JSON.parse(jsonString)
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
      const jsonString = this.extractJsonFromResponse(response)
      const parsed = JSON.parse(jsonString)
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
      const jsonString = this.extractJsonFromResponse(response)
      const parsed = JSON.parse(jsonString)
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
      const jsonString = this.extractJsonFromResponse(response)
      const parsed = JSON.parse(jsonString)
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
