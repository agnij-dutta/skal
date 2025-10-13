import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'

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
      this.logActivity(`Verifying task ${taskId} with CID ${cid}...`)
      
      // Simulate verification process
      await this.simulateVerification(taskId, cid)
      
      // Generate verification score (0-100)
      const score = this.generateVerificationScore()
      
      this.logActivity(`Verification complete for task ${taskId}: score ${score}`)
      
      // Submit verification to contract
      await this.submitVerification(taskId, score)
      
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
}
