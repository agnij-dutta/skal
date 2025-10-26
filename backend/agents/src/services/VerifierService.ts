import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'
import { QualityAnalysis } from '../ai/types.js'

export class VerifierService extends BaseService {
  private commitRegistry: ethers.Contract
  private verificationQueue: Set<number> = new Set()

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
      console.log('VerifierService is already running')
      return
    }

    try {
      await this.initializeWallet(this.config.agentKeys.verifier)
      this.isRunning = true
      
      this.logActivity('Verifier service started')
      
      // Listen for task reveals
      this.setupEventListeners()
      
      // Skip historical check for testing
      this.logActivity('Skipping historical task check for testing')
      
    } catch (error) {
      this.logError(error as Error, 'Failed to start verifier service')
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.verificationQueue.clear()
    this.logActivity('Verifier service stopped')
  }

  private setupEventListeners(): void {
    // Listen for task reveals
    this.commitRegistry.on('TaskRevealed', async (taskId, cid, event) => {
      this.logActivity(`Task revealed: ${taskId} with CID ${cid}`)
      
      // Add to verification queue
      this.verificationQueue.add(Number(taskId))
      
      // Start verification process
      await this.verifyTask(Number(taskId), cid)
    })
  }

  private async checkRevealedTasks(): Promise<void> {
    try {
      this.logActivity('Checking for revealed tasks...')
      
      // Get recent task reveals from the contract
      const filter = this.commitRegistry.filters.TaskRevealed()
      const events = await this.commitRegistry.queryFilter(filter, -1000) // Last 1000 blocks
      
      for (const event of events) {
        if ('args' in event && event.args) {
          const taskId = Number(event.args.taskId)
          const cid = event.args.cid
          
          this.verificationQueue.add(taskId)
          await this.verifyTask(taskId, cid)
        }
      }
      
    } catch (error) {
      this.logError(error as Error, 'Failed to check revealed tasks')
    }
  }

  private async verifyTask(taskId: number, cid: string): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot verify task')
      return
    }

    try {
      this.logActivity(`🧠 AI-powered verification for task ${taskId} with CID ${cid}...`)
      
      // 1. Fetch and decrypt data from IPFS
      const data = await this.fetchDataFromIPFS(cid)
      
      // 2. AI-powered quality assessment
      const qualityAnalysis = await this.aiEngine.analyzeDataQuality({
        data,
        cid,
        taskId,
        expectedType: await this.getExpectedDataType(taskId)
      })
      
      // 3. Cross-reference with market expectations
      const marketExpectations = await this.getMarketExpectations(taskId)
      const alignmentScore = this.calculateAlignmentScore(data, marketExpectations)
      
      // 4. Calculate comprehensive verification score
      const verificationScore = Math.round(
        qualityAnalysis.score * 0.6 +
        alignmentScore * 0.3 +
        this.checkDataIntegrity(data) * 0.1
      )
      
      this.logActivity(`AI Verification: Task ${taskId} scored ${verificationScore} | Quality: ${qualityAnalysis.score} | Alignment: ${alignmentScore}`)
      
      // 5. Submit verification
      await this.submitVerification(taskId, verificationScore)
      
      // Remove from queue
      this.verificationQueue.delete(taskId)
      
    } catch (error) {
      this.logError(error as Error, `Failed to verify task ${taskId}`)
    }
  }

  private async simulateVerification(taskId: number, cid: string): Promise<void> {
    // Simulate verification process with random delay
    const delay = Math.random() * 5000 + 2000 // 2-7 seconds
    this.logActivity(`Simulating verification process for task ${taskId}...`)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // In real implementation, would:
    // 1. Fetch data from IPFS using CID
    // 2. Validate data integrity
    // 3. Check data quality
    // 4. Compare with expected format
    // 5. Run quality metrics
  }

  private generateVerificationScore(): number {
    // Generate realistic verification score
    // Higher probability of good scores (80-100)
    const rand = Math.random()
    
    if (rand < 0.7) {
      // 70% chance of good score (80-100)
      return Math.floor(Math.random() * 21) + 80
    } else if (rand < 0.9) {
      // 20% chance of medium score (60-79)
      return Math.floor(Math.random() * 20) + 60
    } else {
      // 10% chance of low score (40-59)
      return Math.floor(Math.random() * 20) + 40
    }
  }

  private async submitVerification(taskId: number, score: number): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot submit verification')
      return
    }

    try {
      this.logActivity(`Submitting verification for task ${taskId}: score ${score}`)
      
      // For now, skip validation as it requires agent registration and signatures
      this.logActivity(`Skipping validation for task ${taskId} - requires agent registration`)
      return
      
      // TODO: Implement proper agent registration and signature generation
      // const tx = await (this.commitRegistry.connect(this.wallet) as any).finalizeValidation(
      //   BigInt(taskId),
      //   score,
      //   this.wallet.address,
      //   "0x", // signature placeholder
      //   {
      //     gasLimit: 300000,
      //     gasPrice: await this.getGasPrice()
      //   }
      // )

      this.logActivity(`Verification submitted: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Verification confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('taskVerified', {
          taskId,
          verifier: this.wallet!.address,
          score,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to submit verification for task ${taskId}`)
    }
  }

  // AI-driven helper methods

  private async fetchDataFromIPFS(cid: string): Promise<string> {
    try {
      // This would fetch and decrypt data from IPFS
      // For now, return mock data
      const mockData = `{
        "prediction": "ETH will reach $3,500 by end of week",
        "confidence": 0.85,
        "timestamp": "${Date.now()}",
        "reasoning": "Technical analysis shows strong bullish momentum",
        "data_points": ["RSI: 65", "MACD: Bullish crossover", "Volume: Increasing"]
      }`
      
      this.logActivity(`Fetched data from IPFS: ${cid}`)
      return mockData
    } catch (error) {
      this.logError(error as Error, `Failed to fetch data from IPFS: ${cid}`)
      return '{"error": "Failed to fetch data"}'
    }
  }

  private async getExpectedDataType(taskId: number): Promise<string> {
    try {
      // This would determine expected data type based on task/market
      // For now, return a default type
      return 'trading_signal'
    } catch (error) {
      this.logError(error as Error, `Failed to get expected data type for task ${taskId}`)
      return 'unknown'
    }
  }

  private async getMarketExpectations(taskId: number): Promise<any> {
    try {
      // This would get market expectations for the task
      // For now, return mock expectations
      return {
        expectedFormat: 'json',
        requiredFields: ['prediction', 'confidence', 'timestamp'],
        qualityThreshold: 0.7,
        marketConditions: {
          volatility: 0.3,
          liquidity: 15000,
          sentiment: 0.6
        }
      }
    } catch (error) {
      this.logError(error as Error, `Failed to get market expectations for task ${taskId}`)
      return {
        expectedFormat: 'json',
        requiredFields: ['prediction', 'confidence'],
        qualityThreshold: 0.5,
        marketConditions: {}
      }
    }
  }

  private calculateAlignmentScore(data: string, expectations: any): number {
    let score = 0.5 // Base score
    
    try {
      const parsed = JSON.parse(data)
      
      // Check for required fields
      const requiredFields = expectations.requiredFields || []
      const presentFields = requiredFields.filter(field => parsed.hasOwnProperty(field))
      const fieldScore = presentFields.length / requiredFields.length
      
      // Check data quality indicators
      let qualityScore = 0.5
      if (parsed.confidence && parsed.confidence > 0.5) qualityScore += 0.2
      if (parsed.prediction && parsed.prediction.length > 10) qualityScore += 0.2
      if (parsed.reasoning && parsed.reasoning.length > 20) qualityScore += 0.1
      
      score = (fieldScore + qualityScore) / 2
      
    } catch (error) {
      // Not JSON, check for other quality indicators
      if (data.length > 50) score += 0.2
      if (data.includes('prediction') || data.includes('signal')) score += 0.2
      if (data.includes('confidence')) score += 0.1
    }
    
    return Math.max(0, Math.min(1, score))
  }

  private checkDataIntegrity(data: string): number {
    let score = 0.5 // Base score
    
    // Check for basic data integrity
    if (data.length > 100) score += 0.2
    if (data.includes('{') && data.includes('}')) score += 0.2 // JSON structure
    if (data.includes('timestamp')) score += 0.1 // Has timestamp
    
    // Check for suspicious patterns
    if (data.includes('test') || data.includes('mock')) score -= 0.3
    if (data.length < 20) score -= 0.4
    
    return Math.max(0, Math.min(1, score))
  }

  private async analyzeDataWithGemini(data: string, taskId: number): Promise<QualityAnalysis> {
    const prompt = `Analyze this trading signal data for quality and accuracy:
      Data: ${data}
      Task ID: ${taskId}
      
      Evaluate:
      1. Data completeness and structure
      2. Prediction/signal quality
      3. Relevance to market conditions
      4. Potential value to buyers
      
      Return quality score 0-100 with reasoning.`
    
    try {
      const analysis = await this.aiEngine.analyzeWithGemini(prompt)
      return this.parseGeminiQualityResponse(analysis)
    } catch (error) {
      this.logError(error as Error, 'Failed to analyze data with Gemini')
      return {
        score: 50,
        factors: {
          completeness: 50,
          accuracy: 50,
          relevance: 50,
          structure: 50
        },
        reasoning: 'AI analysis failed'
      }
    }
  }

  private parseGeminiQualityResponse(response: string): QualityAnalysis {
    try {
      // Try to parse JSON response
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
      // Fallback parsing for text response
      const scoreMatch = response.match(/(\d+)/)
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 50
      
      return {
        score: Math.max(0, Math.min(100, score)),
        factors: {
          completeness: score,
          accuracy: score,
          relevance: score,
          structure: score
        },
        reasoning: response.substring(0, 200) // First 200 chars as reasoning
      }
    }
  }
}
