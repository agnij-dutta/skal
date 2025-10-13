import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'

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
      this.logActivity('Creating new task...')
      
      // Generate mock AI output data
      const mockOutput = this.generateMockOutput()
      
      // Upload to storage service (simplified - would use real storage service)
      const cid = await this.uploadToStorage(mockOutput)
      
      // Create commit hash
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes(cid + Date.now()))
      
      // Submit commit to blockchain
      const tx = await (this.commitRegistry.connect(this.wallet) as any).commitTask(
        commitHash,
        BigInt(this.config.marketConfig.marketId),
        ethers.parseEther(this.config.marketConfig.stakeAmount),
        {
          gasLimit: 4000000, // Increased gas limit based on contract requirements
          value: ethers.parseEther(this.config.marketConfig.stakeAmount) // Send STT as stake
        }
      )

      this.logActivity(`Task committed: ${tx.hash}`)
      
      // Wait for confirmation
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
      this.logError(error as Error, 'Failed to create task')
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
}
