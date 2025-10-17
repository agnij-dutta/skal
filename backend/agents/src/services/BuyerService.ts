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
      
      // Listen for new tasks
      this.setupEventListeners()
      
      // Skip historical check for testing
      this.logActivity('Skipping historical task check for testing')
      
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
      // Listen for new task commits
    this.commitRegistry.on('TaskCommitted', async (taskId, commitHash, provider, marketId, stake, event) => {
      this.logActivity(`New task committed: ${taskId} by ${provider}`)
      
      // Add to watched tasks
      this.watchedTasks.add(Number(taskId))
      
      // Evaluate and potentially buy
      await this.evaluateTask(Number(taskId), provider, BigInt(stake))
    })

    // Listen for task reveals
    this.commitRegistry.on('TaskRevealed', async (taskId, cid, event) => {
      this.logActivity(`Task revealed: ${taskId} with CID ${cid}`)
      
      // Remove from watched tasks
      this.watchedTasks.delete(Number(taskId))
    })
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

  private async evaluateTask(taskId: number, provider: string, stake: bigint): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot evaluate task')
      return
    }

    try {
      // 1. Gather comprehensive task data
      const taskData = await this.gatherTaskData(taskId, provider, stake)
      
      // 2. Fast local screening (pre-filter)
      const quickScore = this.localModels.predictTaskQuality(taskData.features)
      if (quickScore < 0.3) {
        this.logActivity(`Task ${taskId} rejected by quick screening (score: ${quickScore})`)
        return
      }
      
      // 3. AI-powered deep analysis
      const decision = await this.aiEngine.analyzeTask(taskData)
      
      // 4. Risk assessment
      const risk = await this.riskManager.assessTaskRisk(taskData)
      
      // 5. Determine optimal buy amount
      const balance = await this.provider.getBalance(this.wallet.address)
      const buyAmount = await this.riskManager.determineOptimalStakeSize(taskData, balance)
      
      // 6. Execute decision
      if (decision.shouldBuy && risk.score < 0.7) {
        this.logActivity(`AI Decision: BUY task ${taskId} | Confidence: ${decision.confidence} | Risk: ${risk.score} | Amount: ${ethers.formatEther(buyAmount)}`)
        await this.buyTask(taskId, ethers.formatEther(buyAmount))
        
        // Track decision for learning
        await this.trackDecision('task_purchase', taskData, decision)
      } else {
        this.logActivity(`AI Decision: SKIP task ${taskId} | Reason: ${decision.reason} | Risk: ${risk.score}`)
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to evaluate task ${taskId}`)
    }
  }

  private async buyTask(taskId: number, amount: string): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot buy task')
      return
    }

    try {
      this.logActivity(`Buying task ${taskId} for ${amount} ETH...`)
      
      const tx = await (this.escrowManager.connect(this.wallet) as any).lockFunds(
        BigInt(taskId),
        {
          gasLimit: 4000000, // Increased gas limit based on contract requirements
          value: ethers.parseEther(amount) // Send STT as escrow amount
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
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to buy task ${taskId}`)
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
