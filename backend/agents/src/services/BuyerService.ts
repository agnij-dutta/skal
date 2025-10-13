import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { ESCROW_MANAGER_ABI } from '../../../../lib/contracts/abis/escrowManager.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'

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
      // Simple evaluation logic - buy if stake is reasonable
      const stakeInEth = Number(ethers.formatEther(stake))
      const buyAmount = this.config.marketConfig.buyAmount
      
      if (stakeInEth <= 0.1) { // Only buy if stake is reasonable
        this.logActivity(`Evaluating task ${taskId}: stake ${stakeInEth} ETH - BUYING`)
        await this.buyTask(taskId, buyAmount)
      } else {
        this.logActivity(`Evaluating task ${taskId}: stake ${stakeInEth} ETH - SKIPPING (too high)`)
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
}
