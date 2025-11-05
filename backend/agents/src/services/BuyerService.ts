import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { ESCROW_MANAGER_ABI } from '../../../../lib/contracts/abis/escrowManager.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'
import { TaskData, TaskFeatures, Decision, Outcome } from '../ai/types.js'

export class BuyerService extends BaseService {
  private escrowManager: ethers.Contract
  private commitRegistry: ethers.Contract
  private watchedTasks: Set<number> = new Set()

  constructor(serviceConfig: ServiceConfig) {
    super(serviceConfig)
    this.escrowManager = new ethers.Contract(
      this.config.contractAddresses.escrowManager,
      ESCROW_MANAGER_ABI,
      this.provider
    )
    this.commitRegistry = new ethers.Contract(
      this.config.contractAddresses.commitRegistry,
      COMMIT_REGISTRY_ABI,
      this.provider
    )
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('BuyerService is already running')
      return
    }

    try {
      await this.initializeWallet(this.config.agentKeys.buyer)
      this.isRunning = true
      
      this.logActivity('Buyer service started')
      
      // Ensure funding immediately and periodically
      try {
        await this.ensureFunding(this.wallet!.address)
      } catch {}
      setInterval(() => {
        this.ensureFunding(this.wallet!.address).catch(() => {})
      }, 60000)
      
      // Listen for new tasks
      this.setupEventListeners()
      
      // Check for existing tasks that haven't been bought yet
      await this.checkExistingTasks()
      
      // Periodic check for all available tasks
      setInterval(async () => {
        await this.checkAllAvailableTasks()
      }, 60000) // Check every minute
      
    } catch (error) {
      this.logError(error as Error, 'Failed to start buyer service')
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.watchedTasks.clear()
    this.logActivity('Buyer service stopped')
  }

  private setupEventListeners(): void {
    // Use polling instead of filters to avoid "too many filters" error
    this.startTaskCommittedPolling()
  }

  private startTaskCommittedPolling(): void {
    let lastProcessedBlock = 0
    const processedEvents = new Set<string>()
    
    const poll = async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber()
        const fromBlock = lastProcessedBlock || Math.max(0, currentBlock - 100)
        
        const eventTopic = this.commitRegistry.interface.getEvent('TaskCommitted')!.topicHash
        const logs = await this.provider.getLogs({
          address: this.config.contractAddresses.commitRegistry,
          topics: [eventTopic],
          fromBlock,
          toBlock: currentBlock
        })
        
        for (const log of logs) {
          const eventId = `${log.blockNumber}-${log.transactionHash}-${log.index || 0}`
          if (processedEvents.has(eventId)) continue
          processedEvents.add(eventId)
          
          try {
            const parsedEvent = this.commitRegistry.interface.parseLog(log)
            if (parsedEvent && parsedEvent.args) {
              const taskId = Number(parsedEvent.args.taskId)
              const provider = parsedEvent.args.provider
              const stake = parsedEvent.args.stake
              
              this.logActivity(`New task committed: ${taskId} by ${provider}`)
              this.watchedTasks.add(taskId)
              await this.evaluateTask(taskId, provider, stake)
            }
          } catch (parseError) {
            continue
          }
        }
        
        lastProcessedBlock = currentBlock + 1
      } catch (error) {
        this.logError(error as Error, 'Failed to poll for TaskCommitted events')
      }
      
      // Poll every 5 seconds
      setTimeout(poll, 5000)
    }
    
    poll()
  }

  private async checkExistingTasks(): Promise<void> {
    try {
      this.logActivity('Checking for existing tasks...')
      
      // Get recent tasks from the contract (reduced range for testing)
      const filter = this.commitRegistry.filters.TaskCommitted()
      const events = await this.commitRegistry.queryFilter(filter, -100) // Last 100 blocks
      
      for (const event of events) {
        if ('args' in event && event.args) {
          const taskId = Number(event.args.taskId)
          const provider = event.args.provider
          const stake = event.args.stake
          
          this.watchedTasks.add(taskId)
          await this.evaluateTask(taskId, provider, stake)
        }
      }
      
    } catch (error) {
      this.logError(error as Error, 'Failed to check existing tasks')
    }
  }

  private async checkAllAvailableTasks(): Promise<void> {
    try {
      this.logActivity('🔍 Scanning all available tasks...')
      
      // Get all task commits from recent history
      const filter = this.commitRegistry.filters.TaskCommitted()
      const events = await this.commitRegistry.queryFilter(filter, -500) // Last 500 blocks
      
      for (const event of events) {
        if ('args' in event && event.args) {
          const taskId = Number(event.args.taskId)
          
          // Skip if already watched/evaluated
          if (this.watchedTasks.has(taskId)) {
            continue
          }
          
          // Check if task is still uncommitted (not revealed yet)
          try {
            const task = await this.commitRegistry.getTask(taskId)
            
            // If task has no revealed data (CID is empty), it's still available
            if (!task.revealed || task.cid === '') {
              const provider = event.args.provider
              const stake = event.args.stake
              
              this.watchedTasks.add(taskId)
              this.logActivity(`Found available task ${taskId}, evaluating...`)
              await this.evaluateTask(taskId, provider, stake)
            }
          } catch (error) {
            // Task might not exist or error occurred, skip
            continue
          }
        }
      }
      
    } catch (error) {
      this.logError(error as Error, 'Failed to check all available tasks')
    }
  }

  private async evaluateTask(taskId: number, provider: string, stake: bigint): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot evaluate task')
      return
    }

    try {
      // 1. Gather comprehensive task data
      const taskData = await this.gatherTaskData(taskId, provider, stake)
      
      // 2. Fast local screening (pre-filter) - more lenient threshold
      const LocalMLModels = (await import('../ai/LocalMLModels.js')).LocalMLModels
      const localModels = new LocalMLModels()
      const quickScore = localModels.predictTaskQuality(taskData.features)
      if (quickScore < 0.2) { // Lowered from 0.3 to 0.2
        this.logActivity(`Task ${taskId} rejected by quick screening (score: ${quickScore})`)
        return
      }
      
      // 3. AI-powered deep analysis
      const decision = await this.aiEngine.analyzeTask(taskData)
      
      // 4. Risk assessment
      const risk = await this.riskManager.assessTaskRisk(taskData)
      
      // 5. Determine optimal buy amount
      const balance = await this.provider.getBalance(this.wallet.address)
      let buyAmount = await this.riskManager.determineOptimalStakeSize(taskData, balance)
      
      // Ensure minimum buy amount (0.01 STT)
      const minBuyAmount = ethers.parseEther('0.01')
      if (buyAmount < minBuyAmount) {
        buyAmount = minBuyAmount
      }
      
      // 6. Execute decision - more aggressive buying strategy
      // Buy if: AI recommends AND (risk is acceptable OR confidence is very high)
      const shouldBuy = decision.shouldBuy && (risk.score < 0.8 || decision.confidence > 0.85)
      
      if (shouldBuy) {
        this.logActivity(`AI Decision: BUY task ${taskId} | Confidence: ${decision.confidence} | Risk: ${risk.score} | Amount: ${ethers.formatEther(buyAmount)}`)
        await this.buyTask(taskId, ethers.formatEther(buyAmount), provider)
        
        // Track decision for learning
        await this.trackDecision('task_purchase', taskData, decision)
      } else {
        this.logActivity(`AI Decision: SKIP task ${taskId} | Reason: ${decision.reason} | Risk: ${risk.score}`)
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to evaluate task ${taskId}`)
    }
  }

  private async buyTask(taskId: number, amount: string, provider: string): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot buy task')
      return
    }

    try {
      const buyAmount = ethers.parseEther(amount)
      
      // Estimate gas for the transaction
      let gasEstimate: bigint
      let gasCost: bigint
      try {
        gasEstimate = await (this.escrowManager.connect(this.wallet) as any).lockFunds.estimateGas(
          BigInt(taskId),
          {
            value: buyAmount
          }
        )
        // Add 20% buffer for gas estimate
        gasEstimate = (gasEstimate * BigInt(120)) / BigInt(100)
        
        // Get gas price
        const feeData = await this.provider.getFeeData()
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei')
        gasCost = gasEstimate * gasPrice
        
        this.logActivity(`💰 Estimated gas: ${gasEstimate.toString()}, cost: ${ethers.formatEther(gasCost)} STT`)
      } catch (gasError: any) {
        // Fallback to safe estimate
        gasEstimate = BigInt(4000000)
        const feeData = await this.provider.getFeeData()
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei')
        gasCost = gasEstimate * gasPrice
        this.logActivity(`⚠️  Gas estimation failed, using safe estimate: ${gasEstimate.toString()}, cost: ${ethers.formatEther(gasCost)} STT`)
      }
      
      const balance = await this.provider.getBalance(this.wallet.address)
      const totalNeeded = buyAmount + gasCost
      
      // Check if we have enough balance (buy amount + gas)
      if (balance < totalNeeded) {
        this.logActivity(`⚠️  Insufficient balance: have ${ethers.formatEther(balance)} STT, need ${ethers.formatEther(totalNeeded)} STT (buy: ${ethers.formatEther(buyAmount)}, gas: ${ethers.formatEther(gasCost)})`)
        this.logActivity(`💧 Attempting to fund wallet before buying...`)
        await this.ensureFunding(this.wallet.address)
        // Wait a bit for funding to settle
        await new Promise(resolve => setTimeout(resolve, 2000))
        // Re-check balance after funding
        const newBalance = await this.provider.getBalance(this.wallet.address)
        if (newBalance < totalNeeded) {
          this.logError(new Error(`Insufficient balance even after funding: have ${ethers.formatEther(newBalance)} STT, need ${ethers.formatEther(totalNeeded)} STT`), 'Cannot buy task')
          return
        }
        this.logActivity(`✅ Balance after funding: ${ethers.formatEther(newBalance)} STT`)
      }

      // Pre-flight check: simulate the transaction
      try {
        await (this.escrowManager.connect(this.wallet) as any).lockFunds.staticCall(
          BigInt(taskId),
          {
            value: buyAmount
          }
        )
        this.logActivity(`✅ Buy simulation passed for task ${taskId}`)
      } catch (simError: any) {
        const reason = this.decodeRevertReason(simError)
        this.logActivity(`⚠️  Buy simulation reverted for task ${taskId}: ${reason}`)
        throw new Error(`Pre-flight check failed: ${reason}`)
      }

      this.logActivity(`Buying task ${taskId} for ${amount} ETH...`)
      
      const tx = await (this.escrowManager.connect(this.wallet) as any).lockFunds(
        BigInt(taskId),
        {
          gasLimit: gasEstimate, // Use estimated gas
          value: buyAmount, // Send STT as escrow amount
          nonce: await this.provider.getTransactionCount(this.wallet.address, 'pending')
        }
      )

      this.logActivity(`Funds locked for task ${taskId}: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Funds locked confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('fundsLocked', {
          taskId,
          buyer: this.wallet!.address,
          amount: ethers.parseEther(amount),
          txHash: tx.hash
        })
        
        // Automatically decrypt and access the purchased task data
        await this.decryptAndAccessTaskData(taskId, provider)
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to buy task ${taskId}`)
    }
  }

  private async decryptAndAccessTaskData(taskId: number, provider: string): Promise<void> {
    try {
      // Get task details to find the CID
      const task = await this.commitRegistry.getTask(taskId)
      if (!task || !task.cid) {
        this.logActivity(`Task ${taskId} not found or no CID available`)
        return
      }

      // Use the same decryption system as the dApp
      const { decryptData } = await import('../../../../lib/storage-client')
      const { generateDeterministicKey, generateDeterministicNonce } = await import('../../../../lib/crypto-utils')
      
      // Generate the same key and nonce as the provider used for encryption
      const tempTaskId = 0 // Same as provider encryption logic
      const key = await generateDeterministicKey(provider, tempTaskId)
      const nonce = await generateDeterministicNonce(provider, tempTaskId)
      
      this.logActivity(`Decrypting task ${taskId} data with key: ${key.slice(0, 16)}...`)
      
      const result = await decryptData(task.cid, key, nonce)
      
      if (result.success && result.data) {
        this.logActivity(`Successfully decrypted task ${taskId} data`)
        // Structured output for frontend/dev parsing
        console.log(JSON.stringify({
          type: 'buyer_decrypted_task',
          taskId,
          cid: task.cid,
          data: result.data
        }, null, 2))
        
        // Store the decrypted data for AI analysis or further processing
        await this.processDecryptedTaskData(taskId, result.data)
      } else {
        this.logActivity(`Failed to decrypt task ${taskId} data: ${result.message}`)
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to decrypt task ${taskId} data`)
    }
  }

  private async processDecryptedTaskData(taskId: number, data: any): Promise<void> {
    try {
      // Parse data if it's a string (might be JSON string)
      let parsedData = data
      if (typeof data === 'string') {
        try {
          parsedData = this.parseJSONFromAIResponse(data)
        } catch {
          // If parsing fails, try to parse as regular JSON
          try {
            parsedData = JSON.parse(data)
          } catch {
            parsedData = { raw: data }
          }
        }
      }
      
      // Process the decrypted trading signal data
      this.logActivity(`Processing decrypted data for task ${taskId}:`)
      
      // Extract key information
      const signalType = parsedData.prediction ? 'Price Prediction' : 
                        parsedData.signal_type ? 'Trading Signal' :
                        parsedData.signal ? 'Trading Signal' : 'Unknown'
      
      this.logActivity(`Signal type: ${signalType}`)
      
      // Log prediction data
      if (parsedData.prediction) {
        this.logActivity(`Prediction: ${parsedData.prediction}`)
      }
      if (parsedData.predicted_outcome) {
        this.logActivity(`Predicted Outcome: ${parsedData.predicted_outcome}`)
      }
      if (parsedData.direction) {
        this.logActivity(`Direction: ${parsedData.direction}`)
      }
      if (parsedData.asset || parsedData.target) {
        this.logActivity(`Asset: ${parsedData.asset || parsedData.target}`)
      }
      if (parsedData.entry_price || parsedData.suggested_entry_price) {
        this.logActivity(`Entry Price: ${parsedData.entry_price || parsedData.suggested_entry_price}`)
      }
      if (parsedData.confidence || parsedData.prediction_confidence) {
        this.logActivity(`Confidence: ${parsedData.confidence || parsedData.prediction_confidence}`)
      }
      if (parsedData.reasoning || parsedData.rationale || parsedData.explanation) {
        const reasoning = parsedData.reasoning || parsedData.rationale || parsedData.explanation
        this.logActivity(`Reasoning: ${reasoning.substring(0, 200)}${reasoning.length > 200 ? '...' : ''}`)
      }
      
      // Structured output for frontend/dev parsing
      console.log(JSON.stringify({
        type: 'buyer_decrypted_task',
        taskId,
        cid: parsedData.cid || 'unknown',
        data: parsedData
      }, null, 2))
      
      console.log(JSON.stringify({
        type: 'buyer_decrypted_task_summary',
        taskId,
        summary: {
          signalType,
          prediction: parsedData.prediction || parsedData.predicted_outcome || null,
          signal: parsedData.signal || parsedData.signal_type || null,
          asset: parsedData.asset || parsedData.target || null,
          direction: parsedData.direction || null,
          entryPrice: parsedData.entry_price || parsedData.suggested_entry_price || null,
          stopLoss: parsedData.stop_loss || parsedData.suggested_stop_loss || null,
          takeProfit: parsedData.take_profit || parsedData.suggested_take_profit || null,
          confidence: parsedData.confidence || parsedData.prediction_confidence || null,
          reasoning: parsedData.reasoning || parsedData.rationale || parsedData.explanation || null
        },
        raw: parsedData
      }, null, 2))
      
    } catch (error) {
      this.logError(error as Error, `Failed to process decrypted data for task ${taskId}`)
    }
  }

  // AI-driven helper methods

  private async gatherTaskData(taskId: number, provider: string, stake: bigint): Promise<TaskData> {
    // Get task details from contract
    const task = await this.commitRegistry.getTask(taskId)
    
    // Get provider reputation
    const reputation = await this.getProviderReputation(provider)
    
    // Get market conditions
    const marketData = await this.marketIntelligence.analyzeMarketConditions(task.marketId)
    
    // Get historical data
    const providerHistory = await this.getProviderHistory(provider)
    
    return {
      taskId,
      provider,
      stake,
      marketId: task.marketId,
      reputation,
      marketData,
      providerHistory,
      timestamp: Date.now(),
      features: this.extractFeatures(task, reputation, marketData)
    }
  }

  private extractFeatures(task: any, reputation: number, marketData: any): TaskFeatures {
    return {
      stakeAmount: Number(ethers.formatEther(task.stake)),
      providerReputation: reputation / 100,
      marketVolatility: marketData.volatility || 0.2,
      timeSinceCommit: Date.now() - Number(task.timestamp) * 1000,
      marketLiquidity: marketData.liquidity || 0,
      competitionLevel: 0.5, // Would need to calculate from market data
      historicalSuccessRate: reputation / 100
    }
  }

  private async getProviderReputation(provider: string): Promise<number> {
    try {
      // This would query the reputation manager contract
      // For now, return a mock value
      return Math.floor(Math.random() * 100)
    } catch (error) {
      this.logError(error as Error, 'Failed to get provider reputation')
      return 50 // Default reputation
    }
  }

  private async getProviderHistory(provider: string): Promise<any> {
    try {
      // This would query historical task data
      // For now, return mock data
      return {
        totalTasks: Math.floor(Math.random() * 50),
        successfulTasks: Math.floor(Math.random() * 40),
        averageScore: Math.floor(Math.random() * 100),
        disputes: Math.floor(Math.random() * 5),
        lastActivity: Date.now() - Math.random() * 86400000 // Random time in last 24h
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to get provider history')
      return {
        totalTasks: 0,
        successfulTasks: 0,
        averageScore: 50,
        disputes: 0,
        lastActivity: Date.now()
      }
    }
  }

  private async trackDecision(type: string, input: any, output: any): Promise<void> {
    const decision: Decision = {
      id: `${type}_${Date.now()}`,
      agentType: 'buyer',
      timestamp: Date.now(),
      input,
      output,
      confidence: output.confidence || 0.5,
      executed: true
    }

    // Store decision for later outcome tracking
    await this.performanceMonitor.trackDecisionOutcome(decision, {
      decisionId: decision.id,
      success: true, // Will be updated when we know the outcome
      actualReturn: 0, // Will be updated when task completes
      timestamp: Date.now()
    })
  }

  private async monitorPurchasedTask(taskId: number): Promise<void> {
    // Track task through lifecycle for learning
    // This would monitor the task until completion and update AI models
    this.logActivity(`Monitoring purchased task ${taskId} for learning`)
  }
}
