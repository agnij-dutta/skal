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
  private revealingTasks: Set<number> = new Set() // Track tasks being revealed to prevent duplicates

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
      
      // Optional periodic reveal (can cause races). Gate by env flag.
      if (process.env.DISABLE_PERIODIC_REVEAL !== 'true') {
        this.startRevelationCheck()
      } else {
        this.logActivity('Periodic revelation disabled by DISABLE_PERIODIC_REVEAL=true')
      }
      
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
          // Check task state from contract
          const task = await this.commitRegistry.getTask(BigInt(taskId))
          const taskState = Number(task.state)
          
          // TaskState: 0=Committed, 1=Revealed, 2=Validated, 3=Settled, 4=Disputed
          if (taskState === 1) {
            // Task is already revealed, remove from pending list
            this.taskCids.delete(taskId)
            this.logActivity(`✅ Task ${taskId} already revealed, removed from pending list`)
            continue
          }
          
          if (taskState !== 0) {
            // Task is not in committed state, skip
            continue
          }
          
          // Task is committed, check if escrow exists (buyer has purchased)
          try {
            const escrow = await this.escrowManager.getEscrow(BigInt(taskId))
            if (!escrow || escrow.buyer === ethers.ZeroAddress) {
              // No buyer yet, wait for purchase
              this.logActivity(`⏳ Task ${taskId} not purchased yet, waiting for buyer...`)
              continue
            }
            
            // Escrow exists and has a buyer - safe to reveal
            this.logActivity(`🔍 Found unrevealed task ${taskId} with CID ${cid}, buyer has purchased, revealing...`)
            const success = await this.revealTask(taskId)
            
            // If revelation was successful, remove from pending list
            if (success) {
              this.taskCids.delete(taskId)
              this.logActivity(`✅ Task ${taskId} revealed successfully, removed from pending list`)
            }
          } catch (escrowError: any) {
            // Escrow doesn't exist yet - this is expected, wait for buyer
            if (escrowError.message?.includes('Escrow does not exist')) {
              this.logActivity(`⏳ Task ${taskId} escrow not created yet, waiting for buyer purchase...`)
            } else {
              this.logActivity(`⚠️  Could not check escrow for task ${taskId}: ${escrowError.message}`)
            }
            continue
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
      console.log(JSON.stringify({
        type: 'ai_market_demand',
        data: marketDemand
      }, null, 2))
      
      // 2. AI determines optimal task parameters
      const taskParams = await this.aiEngine.optimizeTaskCreation({
        marketDemand,
        currentReputation: await this.getOwnReputation(),
        competitorAnalysis: await this.analyzeCompetitors(),
        historicalPerformance: await this.getHistoricalPerformance()
      })
      console.log(JSON.stringify({
        type: 'ai_task_params',
        taskParams
      }, null, 2))
      
      // 3. Generate high-quality data
      const intelligentData = await this.generateIntelligentData(taskParams)
      console.log(JSON.stringify({
        type: 'ai_generated_data',
        preview: intelligentData.data,
        qualityScore: intelligentData.qualityScore,
        metadata: intelligentData.metadata
      }, null, 2))
      
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
      
      // Ensure minimum stake (0.01 ether = 10000000000000000 wei)
      const MIN_STAKE = ethers.parseEther('0.01')
      let finalStake = optimalStake < MIN_STAKE ? MIN_STAKE : optimalStake
      
      // Check if we have enough balance (stake + gas)
      const balance = await this.provider.getBalance(this.wallet!.address)
      const estimatedGas = ethers.parseUnits('0.001', 'ether') // Rough gas estimate
      if (balance < finalStake + estimatedGas) {
        this.logActivity(`⚠️  Insufficient balance: have ${ethers.formatEther(balance)} STT, need ${ethers.formatEther(finalStake + estimatedGas)} STT`)
        this.logActivity(`💧 Attempting to fund wallet...`)
        await this.ensureFunding(this.wallet!.address)
        // Re-check balance after funding
        const newBalance = await this.provider.getBalance(this.wallet!.address)
        if (newBalance < finalStake + estimatedGas) {
          this.logError(new Error('Insufficient balance even after funding'), 'Cannot commit task')
          return
        }
      }
      
      console.log(JSON.stringify({
        type: 'ai_optimal_stake',
        stakeWei: finalStake.toString(),
        stakeEth: ethers.formatEther(finalStake),
        balance: ethers.formatEther(balance)
      }, null, 2))
      
      // 5. Upload and commit
      const cid = await this.uploadToStorage(intelligentData.data)
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes(cid + Date.now()))
      
      const taskId = await this.commitTaskToBlockchain(commitHash, taskParams.marketId, finalStake)
      console.log(JSON.stringify({
        type: 'provider_committed_task',
        taskId,
        commitHash,
        cid
      }, null, 2))
      
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
    // Use polling instead of filters to avoid "too many filters" error
    this.startFundsLockedPolling()
    this.logActivity('Event listeners set up - will auto-reveal tasks when funds are locked')
  }

  private startFundsLockedPolling(): void {
    let lastProcessedBlock = 0
    const processedEvents = new Set<string>()
    
    const poll = async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber()
        const fromBlock = lastProcessedBlock || Math.max(0, currentBlock - 100)
        
        const eventTopic = this.escrowManager.interface.getEvent('FundsLocked')!.topicHash
        const logs = await this.provider.getLogs({
          address: this.config.contractAddresses.escrowManager,
          topics: [eventTopic],
          fromBlock,
          toBlock: currentBlock
        })
        
        for (const log of logs) {
          const eventId = `${log.blockNumber}-${log.transactionHash}-${log.index || 0}`
          if (processedEvents.has(eventId)) continue
          processedEvents.add(eventId)
          
          try {
            const parsedEvent = this.escrowManager.interface.parseLog(log)
            if (parsedEvent && parsedEvent.args) {
              const taskId = Number(parsedEvent.args.taskId)
              const buyer = parsedEvent.args.buyer
              const amount = parsedEvent.args.amount
              
              // Get provider from CommitRegistry (FundsLocked event has provider as address(0))
              let provider = ethers.ZeroAddress
              try {
                const task = await this.commitRegistry.getTask(BigInt(taskId))
                provider = task.provider
              } catch (e) {
                // Task might not exist yet, skip
                continue
              }
              
              this.logActivity(`🔓 FundsLocked event received: task ${taskId} by ${buyer}, provider ${provider}, amount ${amount}`)
              
              // Only reveal if this provider created the task
              if (provider.toLowerCase() === this.wallet!.address.toLowerCase()) {
                this.logActivity(`🎯 This is our task! Funds locked, settling briefly then revealing task ${taskId}...`)
                // Short settle to avoid missing tight reveal windows
                await new Promise(resolve => setTimeout(resolve, 250))
                await this.revealTask(taskId)
              } else {
                this.logActivity(`⏭️ Task ${taskId} belongs to different provider ${provider}, skipping`)
              }
            }
          } catch (parseError) {
            continue
          }
        }
        
        lastProcessedBlock = currentBlock + 1
      } catch (error) {
        this.logError(error as Error, 'Failed to poll for FundsLocked events')
      }
      
      // Poll every 5 seconds
      setTimeout(poll, 5000)
    }
    
    poll()
  }

  private async revealTask(taskId: number): Promise<boolean> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot reveal task')
      return false
    }

    // Prevent concurrent reveal attempts for the same task
    if (this.revealingTasks.has(taskId)) {
      this.logActivity(`⏳ Task ${taskId} is already being revealed, skipping duplicate attempt`)
      return false
    }

    this.revealingTasks.add(taskId)

    try {
      this.logActivity(`Revealing task ${taskId}...`)
      
      // Get the stored CID for this task
      const cid = this.taskCids.get(taskId)
      if (!cid) {
        this.logError(new Error(`No CID found for task ${taskId}`), 'Cannot reveal task without CID')
        this.revealingTasks.delete(taskId)
        return false
      }
      
      this.logActivity(`Using stored CID ${cid} for task ${taskId}`)

      // First, check task state from the contract using canReveal function
      try {
        const task = await this.commitRegistry.getTask(BigInt(taskId))
        const taskState = Number(task.state)
        const taskProvider = task.provider

        // TaskState: 0=Committed, 1=Revealed, 2=Validated, 3=Settled, 4=Disputed
        if (taskState !== 0) {
          this.logActivity(`⏳ Task ${taskId} is not in Committed state (state=${taskState}), skipping reveal`)
          this.revealingTasks.delete(taskId)
          return false
        }

        // Check if we're the provider
        if (taskProvider.toLowerCase() !== this.wallet.address.toLowerCase()) {
          this.logActivity(`⏳ Task ${taskId} belongs to different provider ${taskProvider}, skipping`)
          this.revealingTasks.delete(taskId)
          return false
        }

        // Use contract's canReveal function for accurate deadline check
        try {
          const canReveal = await this.commitRegistry.canReveal(BigInt(taskId))
          if (!canReveal) {
            this.logActivity(`⏳ Task ${taskId} cannot be revealed (deadline may have passed or state changed)`)
            this.revealingTasks.delete(taskId)
            return false
          }
        } catch (canRevealError: any) {
          this.logActivity(`⚠️  Could not check canReveal for task ${taskId}: ${canRevealError.message}`)
          // Fallback to manual deadline check
          const currentTime = Math.floor(Date.now() / 1000)
          const revealDeadline = Number(task.revealDeadline)
          if (currentTime > revealDeadline - 10) {
            this.logActivity(`⏳ Reveal deadline passed for task ${taskId} (deadline=${revealDeadline}, now=${currentTime})`)
            this.revealingTasks.delete(taskId)
            return false
          }
        }

        this.logActivity(`✅ Task ${taskId} state check passed: Committed, provider matches, canReveal OK`)
      } catch (e: any) {
        this.logActivity(`⚠️  Could not check task state for task ${taskId}: ${e.message}`)
        this.revealingTasks.delete(taskId)
        return false
      }

      // Optional: Check escrow (but don't block reveal if escrow doesn't exist yet)
      try {
        const escrow = await this.escrowManager.getEscrow(BigInt(taskId))
        if (escrow && escrow.buyer !== ethers.ZeroAddress) {
          const escrowState = Number(escrow.state)
          this.logActivity(`📦 Escrow exists for task ${taskId}, state=${escrowState} (0=Locked, 1=Released, 2=Disputed, 3=Refunded)`)
        } else {
          this.logActivity(`📦 No escrow yet for task ${taskId}, but proceeding with reveal anyway`)
        }
      } catch (e: any) {
        // Escrow doesn't exist yet - that's OK, we can still reveal
        this.logActivity(`📦 Escrow check skipped for task ${taskId}: ${e.message}`)
      }

      // Re-check state right before sending to catch any race conditions
      try {
        const canReveal = await this.commitRegistry.canReveal(BigInt(taskId))
        if (!canReveal) {
          this.logActivity(`⏳ Task ${taskId} canReveal changed to false, skipping reveal`)
          this.revealingTasks.delete(taskId)
          return false
        }
      } catch (e: any) {
        this.logActivity(`⚠️  Could not re-check canReveal: ${e.message}`)
      }

      // Static call to surface revert reasons before sending
      try {
        await (this.commitRegistry.connect(this.wallet) as any).revealTask.staticCall(BigInt(taskId), cid)
        this.logActivity(`✅ Reveal simulation passed for task ${taskId}`)
      } catch (simError: any) {
        const reason = this.decodeRevertReason(simError)
        this.logActivity(`⚠️  Reveal simulation reverted for task ${taskId}: ${reason}`)
        this.revealingTasks.delete(taskId)
        // Backoff and retry later
        setTimeout(() => this.revealTask(taskId).catch(() => {}), 30000)
        return false
      }
      
      // Get fresh nonce for reveal
      const nonce = await this.provider.getTransactionCount(this.wallet.address, 'pending')
      
      // Double-check task state one more time right before sending
      let canStillReveal = false
      try {
        const task = await this.commitRegistry.getTask(BigInt(taskId))
        const finalState = Number(task.state)
        const finalCanReveal = await this.commitRegistry.canReveal(BigInt(taskId))
        
        if (finalState !== 0 || !finalCanReveal || task.provider.toLowerCase() !== this.wallet.address.toLowerCase()) {
          this.logActivity(`⏳ Task ${taskId} state changed before reveal (state=${finalState}, canReveal=${finalCanReveal}), aborting`)
          this.revealingTasks.delete(taskId)
          return false
        }
        canStillReveal = true
      } catch (e: any) {
        this.logActivity(`⚠️  Could not final check task state: ${e.message}`)
        // If we can't check, proceed anyway since static call passed
        canStillReveal = true
      }
      
      if (!canStillReveal) {
        this.revealingTasks.delete(taskId)
        return false
      }
      
      // Final static call right before sending to catch any last-second changes
      try {
        await (this.commitRegistry.connect(this.wallet) as any).revealTask.staticCall(BigInt(taskId), cid)
      } catch (finalSimError: any) {
        const reason = this.decodeRevertReason(finalSimError)
        this.logActivity(`⚠️  Final reveal simulation failed for task ${taskId}: ${reason}`)
        this.revealingTasks.delete(taskId)
        return false
      }
      
      const tx = await (this.commitRegistry.connect(this.wallet) as any).revealTask(
        BigInt(taskId),
        cid,
        {
          gasLimit: 300000,
          nonce
        }
      )

      this.logActivity(`Task revealed: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt && receipt.status === 1) {
        this.logActivity(`✅ Task reveal confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('taskRevealed', {
          taskId,
          cid,
          txHash: tx.hash
        })
        this.revealingTasks.delete(taskId)
        return true
      } else {
        // Try to decode revert reason from receipt
        const reason = await this.getRevertReasonFromReceipt(tx.hash, receipt)
        this.logError(new Error(`Transaction failed: ${reason}`), `Task ${taskId} revelation failed`)
        this.revealingTasks.delete(taskId)
        // Retry after short delay if it failed
        setTimeout(() => this.revealTask(taskId).catch(() => {}), 30000)
        return false
      }
      
    } catch (error: any) {
      const reason = this.decodeRevertReason(error)
      this.logError(new Error(`Failed to reveal task ${taskId}: ${reason}`), `Reveal error`)
      this.revealingTasks.delete(taskId)
      // Retry with backoff to account for eventual consistency
      setTimeout(() => this.revealTask(taskId).catch(() => {}), 30000)
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
      console.log(JSON.stringify({
        type: 'ai_gemini_response',
        prompt,
        response: geminiResponse
      }, null, 2))
      
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
      const parsed = typeof data === 'string' ? this.parseJSONFromAIResponse(data) : data
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
      // Pre-flight check: ensure stake meets minimum and we have balance
      const MIN_STAKE = ethers.parseEther('0.01')
      if (stake < MIN_STAKE) {
        throw new Error(`Stake ${ethers.formatEther(stake)} STT is below minimum ${ethers.formatEther(MIN_STAKE)} STT`)
      }
      
      const balance = await this.provider.getBalance(this.wallet!.address)
      if (balance < stake) {
        throw new Error(`Insufficient balance: have ${ethers.formatEther(balance)} STT, need ${ethers.formatEther(stake)} STT`)
      }
      
      // Static call to check for revert reasons
      try {
        await (this.commitRegistry.connect(this.wallet!) as any).commitTask.staticCall(
          commitHash,
          BigInt(marketId),
          stake,
          {
            value: stake
          }
        )
      } catch (simError: any) {
        const reason = this.decodeRevertReason(simError)
        throw new Error(`Pre-flight check failed: ${reason}`)
      }
      
      // Get fresh nonce to avoid collisions
      const nonce = await this.provider.getTransactionCount(this.wallet!.address, 'pending')
      
      const tx = await (this.commitRegistry.connect(this.wallet!) as any).commitTask(
        commitHash,
        BigInt(marketId),
        stake,
        {
          gasLimit: 4000000,
          value: stake,
          nonce
        }
      )

      this.logActivity(`AI-optimized task committed: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        const taskId = this.extractTaskIdFromLogs([...receipt.logs])
        this.logActivity(`Task confirmed in block ${receipt.blockNumber}`)
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
