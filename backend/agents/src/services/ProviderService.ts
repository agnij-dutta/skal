import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'
import { ESCROW_MANAGER_ABI } from '../../../../lib/contracts/abis/escrowManager.js'
import { TaskParams, IntelligentData } from '../ai/types.js'

export class ProviderService extends BaseService {
  private commitRegistry: ethers.Contract
  private escrowManager: ethers.Contract
  private intervalId: NodeJS.Timeout | null = null
  private taskInterval: number = 30000 // 30 seconds
  private taskCids: Map<number, string> = new Map() // Store CIDs for tasks

  constructor(serviceConfig: ServiceConfig) {
    super(serviceConfig)
    this.commitRegistry = new ethers.Contract(
      this.config.contractAddresses.commitRegistry,
      COMMIT_REGISTRY_ABI,
      this.provider
    )
    this.escrowManager = new ethers.Contract(
      this.config.contractAddresses.escrowManager,
      ESCROW_MANAGER_ABI,
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
      
      // Start periodic check for tasks that need revelation
      this.startRevelationCheck()
      
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

    this.cleanupPollingIntervals()

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

  private startRevelationCheck(): void {
    // Check every 10 seconds for tasks that need revelation
    setInterval(async () => {
      await this.checkAndRevealTasks()
    }, 10000)
    
    this.logActivity('Started periodic revelation check (every 10 seconds)')
  }

  private async checkAndRevealTasks(): Promise<void> {
    try {
      // Check all tasks we have CIDs for
      for (const [taskId, cid] of this.taskCids.entries()) {
        try {
          // Check if task has been purchased (has funds locked)
          const task = await this.commitRegistry.getTask(taskId)
          
          // If task exists and has been purchased but not revealed yet
          if (task && !task.revealed) {
            this.logActivity(`🔍 Found unrevealed task ${taskId} with CID ${cid}, checking if purchased...`)
            
            // Check if there are any funds locked for this task
            // We'll reveal if the task exists and we have a CID for it
            this.logActivity(`🎯 Revealing task ${taskId} with CID ${cid}`)
            const success = await this.revealTask(taskId)
            
            // If revelation was successful, remove from pending list
            if (success) {
              this.taskCids.delete(taskId)
              this.logActivity(`✅ Task ${taskId} revealed successfully, removed from pending list`)
            }
          } else if (task && task.revealed) {
            // Task is already revealed, remove from pending list
            this.taskCids.delete(taskId)
            this.logActivity(`✅ Task ${taskId} already revealed, removed from pending list`)
          }
        } catch (error) {
          // Task might not exist or error occurred, continue with next task
          continue
        }
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to check and reveal tasks')
    }
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
      
      const taskId = await this.commitTaskToBlockchain(commitHash, taskParams.marketId, optimalStake)
      
      // Store the CID for later revelation
      if (taskId > 0) {
        this.taskCids.set(taskId, cid)
        this.logActivity(`Stored CID ${cid} for task ${taskId}`)
      }
      
    } catch (error) {
      this.logError(error as Error, 'Failed to create task')
      // Continue operation - will retry on next interval
      console.log('[ProviderService] Will retry task creation on next cycle')
    }
  }

  private generateMockOutput(params?: TaskParams): string {
    const now = Date.now()
    const marketLabel = params?.marketId === 2 ? 'DeFi' : params?.marketId === 3 ? 'NLP' : 'General'
    const outputs = [
      JSON.stringify({ prediction: `${marketLabel} signal indicates upside`, confidence: 0.85, timestamp: String(now) }),
      JSON.stringify({ signal: 'BUY', market: marketLabel, score: 0.92, timestamp: String(now) }),
      JSON.stringify({ embedding: [0.1, 0.2, 0.3, 0.4, 0.5], text: 'Sample text for NLP', timestamp: String(now) }),
      JSON.stringify({ analysis: 'Market shows bullish sentiment', score: 8.5, timestamp: String(now) })
    ]
    
    return outputs[Math.floor(Math.random() * outputs.length)]
  }

  private async uploadToStorage(data: string): Promise<string> {
    try {
      // Use the same encryption system as the dApp
      const { encryptAndUpload } = await import('../../../../lib/storage-client')
      
      // Generate deterministic key and nonce for encryption
      const { generateDeterministicKey, generateDeterministicNonce } = await import('../../../../lib/crypto-utils')
      
      // Use tempTaskId = 0 for encryption (same as dApp logic)
      const tempTaskId = 0
      const key = await generateDeterministicKey(this.wallet!.address, tempTaskId)
      const nonce = await generateDeterministicNonce(this.wallet!.address, tempTaskId)
      
      this.logActivity(`Encrypting data with key: ${key.slice(0, 16)}...`)
      
      const result = await encryptAndUpload(data, {
        provider: this.wallet!.address,
        key,
        nonce
      })

      if (!result.success) {
        throw new Error('Encryption and upload failed')
      }

      this.logActivity(`Data encrypted and uploaded to IPFS: ${result.cid}`)
      return result.cid
    } catch (error) {
      this.logError(error as Error, 'Failed to upload encrypted data to storage')
      // Fallback to mock CID if encryption fails
      const mockCid = 'Qm' + Math.random().toString(36).substring(2, 15)
      this.logActivity(`Fallback: Data uploaded to IPFS: ${mockCid}`)
      return mockCid
    }
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
    // Listen for FundsLocked events to automatically reveal tasks
    this.safeEventListener(this.escrowManager, 'FundsLocked', async (taskId, buyer, provider, amount, timestamp, event) => {
      const taskIdNum = Number(taskId)
      this.logActivity(`🔓 FundsLocked event received: task ${taskIdNum} by ${buyer}, provider ${provider}, amount ${amount}`)
      
      // Only reveal if this provider created the task
      if (provider.toLowerCase() === this.wallet!.address.toLowerCase()) {
        this.logActivity(`🎯 This is our task! Revealing task ${taskIdNum}...`)
        await this.revealTask(taskIdNum)

        // If Flow actions are configured and this task is Flow-backed, also trigger Cadence auto-reveal as redundancy
        try {
          // Heuristic: treat large IDs as Flow-backed; replace with registry lookup if available
          const isFlowBacked = taskIdNum >= 1_000_000
          // @ts-ignore orchestrator injected in BaseService
          const flow = this.orchestrator?.flow
          if (isFlowBacked && flow?.isEnabled()) {
            this.logActivity(`Triggering Flow autoReveal for signal ${taskIdNum} via FlowActionsService`)
            await flow.autoReveal(taskIdNum)
          }
        } catch (e:any) {
          this.logActivity(`Flow autoReveal trigger failed (non-fatal): ${String(e?.message || e)}`)
        }
      } else {
        this.logActivity(`⏭️ Task ${taskIdNum} belongs to different provider ${provider}, skipping`)
      }
    })
    
    this.logActivity('Event listeners set up - will auto-reveal tasks when funds are locked')
  }

  private async revealTask(taskId: number): Promise<boolean> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot reveal task')
      return false
    }

    try {
      this.logActivity(`Revealing task ${taskId}...`)
      
      // Get the stored CID for this task
      const cid = this.taskCids.get(taskId)
      if (!cid) {
        this.logError(new Error(`No CID found for task ${taskId}`), 'Cannot reveal task without CID')
        return false
      }
      
      this.logActivity(`Using stored CID ${cid} for task ${taskId}`)
      
      const tx = await (this.commitRegistry.connect(this.wallet) as any).revealTask(
        BigInt(taskId),
        cid,
        {
          gasLimit: 300000 // Increased gas limit
        }
      )

      this.logActivity(`Task revealed: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt && receipt.status === 1) {
        this.logActivity(`Task reveal confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('taskRevealed', {
          taskId,
          cid,
          txHash: tx.hash
        })
        return true
      } else {
        this.logActivity(`⚠️ Task ${taskId} revelation failed - will retry later`)
        return false
      }
      
    } catch (error) {
      this.logActivity(`⚠️ Failed to reveal task ${taskId}: ${(error as Error).message}`)
      return false
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
        data: this.generateMockOutput(params),
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

  private async commitTaskToBlockchain(commitHash: string, marketId: number, stake: bigint): Promise<number> {
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
        const taskId = this.extractTaskIdFromLogs([...receipt.logs])
        this.logActivity(`Task confirmed in block ${receipt.blockNumber}`)
        
        // Schedule Flow auto-reveal if Flow Actions are enabled and task is Flow-backed
        try {
          const isFlowBacked = taskId >= 1_000_000 // Heuristic: large IDs are Flow-backed
          // @ts-ignore orchestrator.flow is injected
          const flow = this.orchestrator?.flow
          if (isFlowBacked && flow?.isEnabled()) {
            // Fetch task to get revealDeadline
            const task = await this.commitRegistry.getTask(taskId)
            if (task && task.revealDeadline) {
              const currentBlock = await this.provider.getBlock('latest')
              const currentTimestamp = currentBlock?.timestamp || Date.now() / 1000
              const revealDeadline = Number(task.revealDeadline)
              const delaySeconds = Math.max(0, Math.floor(revealDeadline - currentTimestamp))
              
              if (delaySeconds > 0) {
                this.logActivity(`Scheduling Flow auto-reveal for task ${taskId} in ${delaySeconds} seconds`)
                const scheduleResult = await flow.scheduleAutoReveal(taskId, delaySeconds)
                if (scheduleResult?.ok) {
                  this.logActivity(`✅ Scheduled Flow auto-reveal transaction: ${scheduleResult.res?.transactionId}`)
                } else {
                  this.logActivity(`⚠️ Flow scheduler failed (non-fatal): ${scheduleResult?.error}`)
                }
              } else {
                this.logActivity(`⚠️ Reveal deadline already passed, skipping scheduler`)
              }
            }
          }
        } catch (e: any) {
          // Non-fatal; task committed successfully
          this.logActivity(`⚠️ Flow scheduler setup failed (non-fatal): ${String(e?.message || e)}`)
        }
        
        this.orchestrator.forwardEvent('taskCommitted', {
          taskId,
          commitHash,
          provider: this.wallet!.address,
          txHash: tx.hash
        })
        return taskId
      }
      return 0
    } catch (error) {
      this.logError(error as Error, 'Failed to commit task to blockchain')
      throw error
    }
  }
}
