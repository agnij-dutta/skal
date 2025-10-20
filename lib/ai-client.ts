// AI Microservices Client for Dapp Integration
const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:3001'
const AGENT_SERVICE_URL = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:3003'

export class AIClient {
  private aiServiceUrl: string
  private agentServiceUrl: string

  constructor() {
    this.aiServiceUrl = AI_SERVICE_URL
    this.agentServiceUrl = AGENT_SERVICE_URL
  }

  // AI Decision Making
  async analyzeTask(taskId: number, provider: string, stake: string, marketId: number, reputation?: number) {
    const response = await fetch(`${this.aiServiceUrl}/analyze-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        provider,
        stake,
        marketId,
        reputation: reputation || 50 + Math.random() * 40
      })
    })
    return await response.json()
  }

  async generateIntelligentData(marketId: number, marketType?: string, targetQuality?: number) {
    const response = await fetch(`${this.aiServiceUrl}/generate-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId,
        marketType: marketType || 'ETH Price Prediction',
        targetQuality: targetQuality || 0.8,
        dataType: 'json'
      })
    })
    return await response.json()
  }

  async verifyDataQuality(data: string, cid: string, taskId: number, expectedType?: string) {
    const response = await fetch(`${this.aiServiceUrl}/verify-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data,
        cid,
        taskId,
        expectedType: expectedType || 'json'
      })
    })
    return await response.json()
  }

  async getMarketAnalysis(marketId: number) {
    const response = await fetch(`${this.aiServiceUrl}/market-analysis/${marketId}`)
    return await response.json()
  }

  async getLiquidityStrategy(markets: any[], currentPositions: any[], availableCapital: string) {
    const response = await fetch(`${this.aiServiceUrl}/liquidity-strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markets,
        currentPositions,
        availableCapital
      })
    })
    return await response.json()
  }

  async getPerformanceMetrics() {
    const response = await fetch(`${this.aiServiceUrl}/performance`)
    return await response.json()
  }

  // Agent Actions
  async commitTask(marketId: number, stake: number, data: string, walletKey: string) {
    const response = await fetch(`${this.agentServiceUrl}/provider/commit-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId,
        stake,
        data,
        walletKey
      })
    })
    return await response.json()
  }

  async evaluateAndBuyTask(taskId: number, provider: string, stake: string, marketId: number, walletKey: string) {
    const response = await fetch(`${this.agentServiceUrl}/buyer/evaluate-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        provider,
        stake,
        marketId,
        walletKey
      })
    })
    return await response.json()
  }

  async verifyTask(taskId: number, cid: string, data: string, walletKey: string) {
    const response = await fetch(`${this.agentServiceUrl}/verifier/verify-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        cid,
        data,
        walletKey
      })
    })
    return await response.json()
  }

  async getLiquidityStrategy(markets: any[], currentPositions: any[], availableCapital: string) {
    const response = await fetch(`${this.agentServiceUrl}/lp/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markets,
        currentPositions,
        availableCapital
      })
    })
    return await response.json()
  }

  async executeLiquidityAction(action: 'add' | 'remove', marketId: number, amounts: any, walletKey: string) {
    const response = await fetch(`${this.agentServiceUrl}/lp/execute-liquidity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        marketId,
        amounts,
        walletKey
      })
    })
    return await response.json()
  }

  async getMarketData(marketId: number) {
    const response = await fetch(`${this.agentServiceUrl}/market/${marketId}`)
    return await response.json()
  }

  // Health checks
  async checkAIServiceHealth() {
    const response = await fetch(`${this.aiServiceUrl}/health`)
    return await response.json()
  }

  async checkAgentServiceHealth() {
    const response = await fetch(`${this.agentServiceUrl}/health`)
    return await response.json()
  }
}

// Export singleton instance
export const aiClient = new AIClient()


