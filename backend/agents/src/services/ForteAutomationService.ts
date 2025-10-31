import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'
import { ESCROW_MANAGER_ABI } from '../../../../lib/contracts/abis/escrowManager.js'

// Minimal ABI for the Verification Aggregator used by automation
const VERIFICATION_AGGREGATOR_ABI = [
  'event TaskFinalized(uint256 indexed taskId, uint8 finalScore, address[] verifiers)',
  'function hasConsensus(uint256 taskId) external view returns (bool)',
  'function getSubmissionCount(uint256 taskId) external view returns (uint256)'
]

export class ForteAutomationService extends BaseService {
  private commitRegistry: ethers.Contract
  private escrowManager: ethers.Contract
  private verificationAggregator: ethers.Contract
  private monitorInterval: NodeJS.Timeout | null = null

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
    this.verificationAggregator = new ethers.Contract(
      this.config.contractAddresses.verificationAggregator,
      VERIFICATION_AGGREGATOR_ABI,
      this.provider
    )
  }

  async start(): Promise<void> {
    try {
      this.logActivity('Forte automation service starting...')
      // Use verifier key by default for automation actions
      await this.initializeWallet(this.config.agentKeys.verifier)

      // Listen for consensus and immediately settle
      this.setupEventListeners()

      // Fallback monitor in case an event is missed
      this.startConsensusMonitor()

      this.logActivity('Forte automation active: consensus -> settlement wiring enabled')
    } catch (error) {
      this.logError(error as Error, 'Failed to start Forte automation')
    }
  }

  async stop(): Promise<void> {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
    this.logActivity('Forte automation service stopped')
  }

  private setupEventListeners(): void {
    // When consensus is reached, settle funds and finalize task
    this.safeEventListener(this.verificationAggregator, 'TaskFinalized', async (taskId: ethers.BigNumberish, finalScore: number) => {
      const taskIdNum = Number(taskId)
      await this.handleSettlement(taskIdNum, finalScore)
    })
  }

  private startConsensusMonitor(): void {
    // Periodically scan recent tasks and settle any that reached consensus
    this.monitorInterval = setInterval(async () => {
      try {
        const totalTasks: bigint = await this.commitRegistry.getTotalTasks()
        const lastId = Number(totalTasks)
        const start = Math.max(1, lastId - 50) // scan last 50 tasks
        for (let id = start; id <= lastId; id++) {
          try {
            const has = await this.verificationAggregator.hasConsensus(id)
            if (has) {
              // Pull score from task (recorded by registry during finalize)
              const task = await this.commitRegistry.getTask(id)
              const score: number = Number(task.validationScore || 0)
              await this.handleSettlement(id, score)
            }
          } catch (err) {
            // ignore per-id errors
          }
        }
      } catch (error) {
        this.logActivity(`Consensus monitor error: ${(error as Error).message}`)
      }
    }, 60_000) // every 60s
  }

  private async handleSettlement(taskId: number, finalScore: number): Promise<void> {
    try {
      this.logActivity(`🔗 Consensus reached for task ${taskId} (score ${finalScore}) → settling funds`)

      // Fetch task to obtain provider
      const task = await this.commitRegistry.getTask(taskId)
      const providerAddr: string = task?.provider

      if (!providerAddr || providerAddr === ethers.ZeroAddress) {
        this.logActivity(`⚠️ Cannot settle task ${taskId} - provider missing`)
        return
      }

      // Release funds from escrow to provider (score used for fee/payout calc on-chain)
      const escrowWithSigner = this.escrowManager.connect(this.wallet!)
      const tx = await escrowWithSigner.releaseFunds(taskId, providerAddr, finalScore)
      this.logActivity(`Settlement tx submitted for task ${taskId}: ${tx.hash}`)
      await this.waitForTransaction(tx.hash)

      // Mark task settled on registry if method exists
      try {
        const commitWithSigner = this.commitRegistry.connect(this.wallet!)
        const settleTx = await commitWithSigner.settleTask(taskId)
        this.logActivity(`CommitRegistry.settleTask submitted: ${settleTx.hash}`)
        await this.waitForTransaction(settleTx.hash)
      } catch (err) {
        // Optional; not all flows require explicit settle here
      }

      this.logActivity(`✅ Settlement completed for task ${taskId}`)
    } catch (error) {
      this.logActivity(`⚠️ Settlement failed for task ${taskId}: ${(error as Error).message}`)
    }
  }
}

export default ForteAutomationService


