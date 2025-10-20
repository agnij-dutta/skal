import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'
import { TaskParams, IntelligentData } from '../ai/types.js'

export class ProviderService extends BaseService {
  private commitRegistry: ethers.Contract
  private intervalId: NodeJS.Timeout | null = null
  private taskInterval: number = 30000 // 30 seconds

  constructor(serviceConfig: ServiceConfig) {
    super(serviceConfig)
    this.commitRegistry = new ethers.Contract(
      this.config.contractAddresses.commitRegistry,
      COMMIT_REGISTRY_ABI,
      this.provider
    )
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('ProviderService is already running')
      return
    }

    try {
      await this.initializeWallet(this.config.agentKeys.provider)
      this.isRunning = true
      
      this.logActivity('Provider service started')
      
      // Start periodic task creation
      this.startTaskCreation()
      
      // Listen for events
      this.setupEventListeners()
      
    } catch (error) {
      this.logError(error as Error, 'Failed to start provider service')
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.logActivity('Provider service stopped')
  }

  private startTaskCreation(): void {
    this.logActivity('Starting periodic task creation')
    
    // Create initial task
    this.createTask()
    
    // Set up interval for periodic tasks
    this.intervalId = setInterval(() => {
      this.createTask()
    }, this.taskInterval)
  }

  private async createTask(): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot create task')
      return
    }

    try {
      this.logActivity('🧠 AI-optimized task creation...')
      
      // 1. Analyze current market demand
      const marketDemand = await this.analyzeMarketDemand()
      
      // 2. AI determines optimal task parameters
      const taskParams = await this.aiEngine.optimizeTaskCreation({
        marketDemand,
        currentReputation: await this.getOwnReputation(),
        competitorAnalysis: await this.analyzeCompetitors(),
        historicalPerformance: await this.getHistoricalPerformance()
      })
      
      // 3. Generate high-quality data
      const intelligentData = await this.generateIntelligentData(taskParams)
      
  // 4. Determine optimal stake
  const optimalStake = await this.riskManager.determineOptimalStakeSize({
    taskId: 0, // Will be set when committed
    provider: this.wallet!.address,
    stake: ethers.parseEther('0.01'), // Base stake
    marketId: taskParams.marketId,
    reputation: await this.getOwnReputation(),
    marketData: marketDemand,
    providerHistory: await this.getHistoricalPerformance(),
    timestamp: Date.now(),
    features: {
      stakeAmount: 0.01,
      providerReputation: await this.getOwnReputation() / 100,
      marketVolatility: marketDemand.volatility || 0.2,
      timeSinceCommit: 0,
      marketLiquidity: marketDemand.liquidity || 10000,
      competitionLevel: taskParams.competitionLevel,
      historicalSuccessRate: await this.getHistoricalPerformance().then(p => p.averageScore / 100)
    }
  }, await this.provider.getBalance(this.wallet!.address))
      
      // 5. Upload and commit
      const cid = await this.uploadToStorage(intelligentData.data)
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes(cid + Date.now()))
      
      await this.commitTaskToBlockchain(commitHash, taskParams.marketId, optimalStake)
      
    } catch (error) {
      this.logError(error as Error, 'Failed to create task')
      // Continue operation - will retry on next interval
      console.log('[ProviderService] Will retry task creation on next cycle')
    }
  }

  private generateMockOutput(): string {
    const outputs = [
      '{"prediction": "ETH will reach $3,500 by end of week", "confidence": 0.85, "timestamp": "' + Date.now() + '"}',
      '{"signal": "BUY", "asset": "ETH", "price": 3200, "confidence": 0.92, "timestamp": "' + Date.now() + '"}',
      '{"embedding": [0.1, 0.2, 0.3, 0.4, 0.5], "text": "Sample text for NLP", "timestamp": "' + Date.now() + '"}',
      '{"analysis": "Market shows bullish sentiment", "score": 8.5, "timestamp": "' + Date.now() + '"}'
    ]
    
    return outputs[Math.floor(Math.random() * outputs.length)]
  }

  private async uploadToStorage(data: string): Promise<string> {
    // Simplified storage upload - in real implementation would use storage service
    const mockCid = 'Qm' + Math.random().toString(36).substring(2, 15)
    this.logActivity(`Data uploaded to IPFS: ${mockCid}`)
    return mockCid
  }

  private extractTaskIdFromLogs(logs: ethers.Log[]): number {
    // Extract task ID from TaskCommitted event logs
    for (const log of logs) {
      try {
        const parsed = this.commitRegistry.interface.parseLog(log)
        if (parsed && parsed.name === 'TaskCommitted') {
          return Number(parsed.args.taskId)
        }
      } catch (error) {
        // Ignore parsing errors for other logs
      }
    }
    return 0
  }

  private setupEventListeners(): void {
    // Note: In a real implementation, we would listen for FundsLocked events
    // from the EscrowManager contract to know when to reveal tasks
    // For now, we'll use a simple timer-based approach
    this.logActivity('Event listeners set up (simplified for testing)')
    
    // Disable automatic reveals for now - they can be triggered manually
    // In production, this would listen for FundsLocked events from EscrowManager
    this.logActivity('Automatic reveals disabled - tasks can be revealed manually')
  }

  private async revealTask(taskId: number): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot reveal task')
      return
    }

    try {
      this.logActivity(`Revealing task ${taskId}...`)
      
      // In real implementation, would fetch actual CID from storage
      const mockCid = 'Qm' + Math.random().toString(36).substring(2, 15)
      
      const tx = await (this.commitRegistry.connect(this.wallet) as any).revealTask(
        BigInt(taskId),
        mockCid,
        {
          gasLimit: 300000 // Increased gas limit
        }
      )

      this.logActivity(`Task revealed: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Task reveal confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('taskRevealed', {
          taskId,
          cid: mockCid,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to reveal task ${taskId}`)
    }
  }

  // AI-driven helper methods

  private async analyzeMarketDemand(): Promise<{ score: number; factors: string[] }> {
    try {
      // Analyze demand across all markets
      const markets = [1, 2, 3]
      const marketAnalyses = await Promise.all(
        markets.map(id => this.marketIntelligence.analyzeMarketConditions(id))
      )
      
      // Calculate overall demand score
      const avgLiquidity = marketAnalyses.reduce((sum, analysis) => sum + analysis.liquidity, 0) / marketAnalyses.length
      const avgVolatility = marketAnalyses.reduce((sum, analysis) => sum + analysis.volatility, 0) / marketAnalyses.length
      
      let demandScore = 0.5 // Base score
      if (avgLiquidity > 20000) demandScore += 0.2
      if (avgVolatility > 0.3) demandScore += 0.2
      if (avgVolatility < 0.1) demandScore -= 0.1
      
      const factors = []
      if (avgLiquidity > 20000) factors.push('High liquidity demand')
      if (avgVolatility > 0.3) factors.push('High volatility demand')
      if (avgVolatility < 0.1) factors.push('Low volatility demand')
      
      return {
        score: Math.max(0, Math.min(1, demandScore)),
        factors
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to analyze market demand')
      return { score: 0.5, factors: ['Analysis failed'] }
    }
  }

  private async getOwnReputation(): Promise<number> {
    try {
      // This would query the reputation manager contract
      // For now, return a mock value
      return Math.floor(Math.random() * 100)
    } catch (error) {
      this.logError(error as Error, 'Failed to get own reputation')
      return 50 // Default reputation
    }
  }

  private async analyzeCompetitors(): Promise<any> {
    try {
      // This would analyze other providers in the market
      // For now, return mock data
      return {
        totalProviders: Math.floor(Math.random() * 20) + 5,
        averageReputation: Math.floor(Math.random() * 100),
        averageStake: Math.random() * 0.1,
        competitionLevel: Math.random()
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to analyze competitors')
      return {
        totalProviders: 10,
        averageReputation: 50,
        averageStake: 0.05,
        competitionLevel: 0.5
      }
    }
  }

  private async getHistoricalPerformance(): Promise<any> {
    try {
      // This would get historical performance data
      // For now, return mock data
      return {
        totalTasks: Math.floor(Math.random() * 100),
        successfulTasks: Math.floor(Math.random() * 80),
        averageScore: Math.floor(Math.random() * 100),
        totalEarnings: Math.random() * 10
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to get historical performance')
      return {
        totalTasks: 0,
        successfulTasks: 0,
        averageScore: 50,
        totalEarnings: 0
      }
    }
  }

  private async generateIntelligentData(params: TaskParams): Promise<IntelligentData> {
    // Use Gemini to generate realistic, high-quality signal data
    const prompt = `Generate a realistic ${params.marketType} trading signal with:
      - Market ID: ${params.marketId}
      - Target quality: ${params.targetQuality}
      - Data type: ${params.dataType}
      - Current market conditions: ${JSON.stringify(params.marketConditions)}
      
      Make it realistic and valuable for traders.`
    
    try {
      const geminiResponse = await this.aiEngine.generateWithGemini(prompt)
      
      return {
        data: geminiResponse,
        qualityScore: this.evaluateDataQuality(geminiResponse),
        metadata: params
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to generate intelligent data')
      // Fallback to mock data
      return {
        data: this.generateMockOutput(),
        qualityScore: 0.6,
        metadata: params
      }
    }
  }

  private evaluateDataQuality(data: string): number {
    // Simple quality evaluation based on data structure and content
    let score = 0.5 // Base score
    
    // Check for JSON structure
    try {
      const parsed = JSON.parse(data)
      score += 0.2
      
      // Check for required fields
      if (parsed.prediction || parsed.signal) score += 0.1
      if (parsed.confidence) score += 0.1
      if (parsed.timestamp) score += 0.1
      
    } catch (error) {
      // Not JSON, check for other quality indicators
      if (data.length > 100) score += 0.1
      if (data.includes('prediction') || data.includes('signal')) score += 0.1
    }
    
    return Math.max(0, Math.min(1, score))
  }

  private async commitTaskToBlockchain(commitHash: string, marketId: number, stake: bigint): Promise<void> {
    try {
      const tx = await (this.commitRegistry.connect(this.wallet!) as any).commitTask(
        commitHash,
        BigInt(marketId),
        stake,
        {
          gasLimit: 4000000,
          value: stake
        }
      )

      this.logActivity(`AI-optimized task committed: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Task confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('taskCommitted', {
          taskId: this.extractTaskIdFromLogs([...receipt.logs]),
          commitHash,
          provider: this.wallet!.address,
          txHash: tx.hash
        })
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to commit task to blockchain')
      throw error
    }
  }
}
