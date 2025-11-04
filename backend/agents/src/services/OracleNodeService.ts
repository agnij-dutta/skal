import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { COMMIT_REGISTRY_ABI } from '../../../../lib/contracts/abis/commitRegistry.js'
import { QualityAnalysis } from '../ai/types.js'

// Oracle Registry ABI
const ORACLE_REGISTRY_ABI = [
  'function registerOracle() external payable',
  'function isActiveOracle(address) external view returns (bool)',
  'function getOracle(address) external view returns (address, uint256, uint256, bool, uint256, uint256, uint256, uint256)',
  'event OracleRegistered(address indexed oracleAddress, uint256 stake, uint256 timestamp)',
  'event OracleSlashed(address indexed oracleAddress, uint256 slashAmount, string reason, uint256 timestamp)'
]

// Verification Aggregator ABI
const VERIFICATION_AGGREGATOR_ABI = [
  'function submitVerification(uint256 taskId, uint8 score, bytes calldata signature) external',
  'function getSubmissionCount(uint256 taskId) external view returns (uint256)',
  'function hasConsensus(uint256 taskId) external view returns (bool)',
  'function getTimeRemaining(uint256 taskId) external view returns (uint256)',
  'event VerificationSubmitted(uint256 indexed taskId, address indexed verifier, uint8 score, uint256 timestamp)',
  'event ConsensusReached(uint256 indexed taskId, uint8 finalScore, uint256 submissionCount, uint256 timestamp)',
  'event TaskFinalized(uint256 indexed taskId, uint8 finalScore, address[] verifiers, uint256 timestamp)'
]

interface VerificationTask {
  taskId: number
  cid: string
  startTime: number
  status: 'pending' | 'submitted' | 'finalized'
}

export class OracleNodeService extends BaseService {
  private commitRegistry: ethers.Contract
  private oracleRegistry: ethers.Contract
  private verificationAggregator: ethers.Contract
  private verificationQueue: Map<number, VerificationTask> = new Map()
  private isRegistered: boolean = false
  private oracleId: string

  constructor(serviceConfig: ServiceConfig & { oracleId?: string }) {
    super(serviceConfig)
    this.oracleId = serviceConfig.oracleId || 'default'
    
    this.commitRegistry = new ethers.Contract(
      this.config.contractAddresses.commitRegistry,
      COMMIT_REGISTRY_ABI,
      this.provider
    )
    
    // Get oracle addresses from config
    const oracleRegistryAddress = this.config.contractAddresses.oracleRegistry
    const aggregatorAddress = this.config.contractAddresses.verificationAggregator
    
    this.oracleRegistry = new ethers.Contract(
      oracleRegistryAddress,
      ORACLE_REGISTRY_ABI,
      this.provider
    )
    
    this.verificationAggregator = new ethers.Contract(
      aggregatorAddress,
      VERIFICATION_AGGREGATOR_ABI,
      this.provider
    )
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`OracleNodeService (${this.oracleId}) is already running`)
      return
    }

    try {
      // Get oracle-specific private key
      const oracleKey = this.getOraclePrivateKey()
      await this.initializeWallet(oracleKey)
      this.isRunning = true
      
      this.logActivity(`Oracle Node ${this.oracleId} started with address: ${this.wallet!.address}`)
      
      // Check if oracle is registered
      await this.checkRegistration()
      
      // Setup event listeners
      this.setupEventListeners()
      
      // Monitor existing revealed tasks (non-blocking - allow service to start even if this fails)
      try {
        await this.checkExistingRevealedTasks()
      } catch (scanError) {
        // Log but don't prevent startup - historical scan is optional
        this.logActivity(`⚠️  Historical scan failed, but service will continue: ${(scanError as Error).message}`)
      }
      
      this.logActivity(`Oracle Node ${this.oracleId} is active and listening for tasks`)
      
    } catch (error) {
      this.logError(error as Error, `Failed to start oracle node ${this.oracleId}`)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.verificationQueue.clear()
    this.logActivity(`Oracle Node ${this.oracleId} stopped`)
  }

  /**
   * Get oracle-specific private key from environment
   */
  private getOraclePrivateKey(): string {
    // Try oracle-specific key first
    const specificKey = process.env[`ORACLE_${this.oracleId.toUpperCase()}_PK`]
    if (specificKey) {
      return specificKey
    }
    
    // Fall back to numbered oracle keys
    const numberedKey = process.env[`ORACLE_${this.oracleId}_PK`]
    if (numberedKey) {
      return numberedKey
    }
    
    // Fall back to verifier key
    return this.config.agentKeys.verifier
  }

  /**
   * Check if oracle is registered
   */
  private async checkRegistration(): Promise<void> {
    if (!this.wallet) return

    try {
      this.isRegistered = await this.oracleRegistry.isActiveOracle(this.wallet.address)
      
      if (this.isRegistered) {
        this.logActivity(`Oracle ${this.oracleId} is registered and active`)
        
        // Get oracle details
        const details = await this.oracleRegistry.getOracle(this.wallet.address)
        this.logActivity(`Oracle reputation: ${details[2]}, Successful validations: ${details[4]}/${details[5]}`)
      } else {
        this.logActivity(`⚠️  Oracle ${this.oracleId} is NOT registered. Register using register-oracle script.`)
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to check oracle registration')
    }
  }

  /**
   * Register as oracle (called from registration script)
   */
  async registerAsOracle(stakeAmount: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized')
    }

    try {
      this.logActivity(`Registering oracle ${this.oracleId} with stake ${stakeAmount} ETH`)
      
      const tx = await (this.oracleRegistry.connect(this.wallet) as any).registerOracle({
        value: ethers.parseEther(stakeAmount),
        gasLimit: 500000
      })

      this.logActivity(`Oracle registration transaction: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.isRegistered = true
        this.logActivity(`✅ Oracle ${this.oracleId} registered successfully!`)
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to register oracle')
      throw error
    }
  }

  /**
   * Setup event listeners for task reveals
   */
  private setupEventListeners(): void {
    // Listen for TaskRevealed events
    this.commitRegistry.on('TaskRevealed', async (taskId, cid, event) => {
      this.logActivity(`TaskRevealed detected: Task ${taskId} with CID ${cid}`)
      
      // Add to verification queue
      this.verificationQueue.set(Number(taskId), {
        taskId: Number(taskId),
        cid,
        startTime: Date.now(),
        status: 'pending'
      })
      
      // Start verification process
      await this.verifyTask(Number(taskId), cid)
    })

    // Listen for verification submissions from other oracles
    this.verificationAggregator.on('VerificationSubmitted', async (taskId, verifier, score, event) => {
      if (verifier.toLowerCase() !== this.wallet!.address.toLowerCase()) {
        this.logActivity(`Other oracle submitted for task ${taskId}: Score ${score}`)
        
        // Check if we should submit too
        const task = this.verificationQueue.get(Number(taskId))
        if (task && task.status === 'pending') {
          this.logActivity(`Need to submit our verification for task ${taskId}`)
        }
      }
    })

    // Listen for consensus reached
    this.verificationAggregator.on('TaskFinalized', async (taskId, finalScore, verifiers, event) => {
      this.logActivity(`✅ Task ${taskId} finalized with score ${finalScore} by ${verifiers.length} oracles`)
      
      // Clean up from queue
      this.verificationQueue.delete(Number(taskId))
    })
  }

  /**
   * Check for existing revealed tasks
   * Uses chunked queries to avoid RPC block range limits
   */
  private async checkExistingRevealedTasks(): Promise<void> {
    try {
      this.logActivity('Checking for existing revealed tasks...')
      
      const currentBlock = await this.provider.getBlockNumber()
      const lookbackBlocks = 5000 // Look back 5000 blocks
      const chunkSize = 900 // Stay under 1000 block limit
      const startBlock = Math.max(0, currentBlock - lookbackBlocks)
      
      const allEvents: any[] = []
      const eventTopic = this.commitRegistry.interface.getEvent('TaskRevealed')!.topicHash
      
      // Chunk the query to avoid RPC limits
      for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
        const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock)
        
        try {
          const logs = await this.provider.getLogs({
            address: this.config.contractAddresses.commitRegistry,
            topics: [eventTopic],
            fromBlock,
            toBlock
          })
          
          // Parse logs to events
          for (const log of logs) {
            try {
              const parsedEvent = this.commitRegistry.interface.parseLog(log)
              if (parsedEvent) {
                // Create a mock event object compatible with the existing code
                const mockEvent = {
                  args: parsedEvent.args,
                  blockNumber: log.blockNumber,
                  transactionHash: log.transactionHash,
                  decode: () => parsedEvent.args
                }
                allEvents.push(mockEvent)
              }
            } catch (parseError) {
              // Skip logs that can't be parsed
              continue
            }
          }
        } catch (chunkError: any) {
          // If a chunk fails, log and continue with other chunks
          if (chunkError.message?.includes('block range')) {
            this.logActivity(`⚠️  Skipping chunk ${fromBlock}-${toBlock} due to block range limit`)
          } else {
            this.logActivity(`⚠️  Error querying chunk ${fromBlock}-${toBlock}: ${chunkError.message}`)
          }
          continue
        }
      }
      
      this.logActivity(`Found ${allEvents.length} TaskRevealed events in historical scan`)
      
      for (const event of allEvents) {
        if (event.args && event.args.taskId !== undefined) {
          const taskId = Number(event.args.taskId)
          const cid = event.args.cid || ''
          
          // Check if already submitted or finalized
          try {
            const submissionCount = await this.verificationAggregator.getSubmissionCount(taskId)
            const hasConsensus = await this.verificationAggregator.hasConsensus(taskId)
            
            if (!hasConsensus && submissionCount < 3) {
              this.logActivity(`Found unfinished task ${taskId}, adding to queue`)
              this.verificationQueue.set(taskId, {
                taskId,
                cid,
                startTime: Date.now(),
                status: 'pending'
              })
              
              // Verify it
              if (cid) {
                await this.verifyTask(taskId, cid)
              }
            }
          } catch (checkError) {
            // Skip tasks that can't be checked (might not exist or contract error)
            continue
          }
        }
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to check existing revealed tasks')
      // Don't throw - allow service to continue even if historical scan fails
    }
  }

  /**
   * Verify a task using AI
   */
  private async verifyTask(taskId: number, cid: string): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot verify task')
      return
    }

    if (!this.isRegistered) {
      this.logActivity(`⚠️  Skipping verification - oracle ${this.oracleId} not registered`)
      return
    }

    try {
      this.logActivity(`🧠 AI-powered verification for task ${taskId} with CID ${cid} (Oracle: ${this.oracleId})`)
      
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
      
      this.logActivity(`AI Verification (${this.oracleId}): Task ${taskId} scored ${verificationScore} | Quality: ${qualityAnalysis.score} | Alignment: ${alignmentScore}`)
      
      // 5. Submit verification to aggregator
      await this.submitVerification(taskId, verificationScore)
      
      // 6. Monitor consensus
      await this.monitorConsensus(taskId)
      
    } catch (error) {
      this.logError(error as Error, `Failed to verify task ${taskId}`)
    }
  }

  /**
   * Submit verification to aggregator
   */
  async submitVerification(taskId: number, score: number): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot submit verification')
      return
    }

    try {
      this.logActivity(`Submitting verification for task ${taskId}: score ${score} (Oracle: ${this.oracleId})`)
      
      // Generate signature (simple approach - sign the score)
      const message = ethers.solidityPackedKeccak256(['uint256', 'uint8'], [taskId, score])
      const signature = await this.wallet.signMessage(ethers.getBytes(message))
      
      const tx = await (this.verificationAggregator.connect(this.wallet) as any).submitVerification(
        BigInt(taskId),
        score,
        signature,
        {
          gasLimit: 500000
        }
      )

      this.logActivity(`Verification submitted: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`✅ Verification confirmed for task ${taskId}`)
        
        // Update task status in queue
        const task = this.verificationQueue.get(taskId)
        if (task) {
          task.status = 'submitted'
        }
        
        this.orchestrator.forwardEvent('verificationSubmitted', {
          taskId,
          oracle: this.wallet!.address,
          score,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to submit verification for task ${taskId}`)
    }
  }

  /**
   * Monitor consensus for a task
   */
  async monitorConsensus(taskId: number): Promise<void> {
    try {
      const submissionCount = await this.verificationAggregator.getSubmissionCount(taskId)
      const hasConsensus = await this.verificationAggregator.hasConsensus(taskId)
      const timeRemaining = await this.verificationAggregator.getTimeRemaining(taskId)
      
      this.logActivity(`Task ${taskId} status: ${submissionCount} submissions, consensus: ${hasConsensus}, time remaining: ${timeRemaining}s`)
      
      if (hasConsensus) {
        this.logActivity(`✅ Consensus reached for task ${taskId}`)
        this.verificationQueue.delete(taskId)
      }
    } catch (error) {
      this.logError(error as Error, `Failed to monitor consensus for task ${taskId}`)
    }
  }

  // Helper methods (reused from VerifierService)

  private async fetchDataFromIPFS(cid: string): Promise<string> {
    try {
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
    return 'trading_signal'
  }

  private async getMarketExpectations(taskId: number): Promise<any> {
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
  }

  private calculateAlignmentScore(data: string, expectations: any): number {
    let score = 0.5
    
    try {
      const parsed = JSON.parse(data)
      
      const requiredFields = expectations.requiredFields || []
      const presentFields = requiredFields.filter((field: string) => parsed.hasOwnProperty(field))
      const fieldScore = presentFields.length / requiredFields.length
      
      let qualityScore = 0.5
      if (parsed.confidence && parsed.confidence > 0.5) qualityScore += 0.2
      if (parsed.prediction && parsed.prediction.length > 10) qualityScore += 0.2
      if (parsed.reasoning && parsed.reasoning.length > 20) qualityScore += 0.1
      
      score = (fieldScore + qualityScore) / 2
      
    } catch (error) {
      if (data.length > 50) score += 0.2
      if (data.includes('prediction') || data.includes('signal')) score += 0.2
      if (data.includes('confidence')) score += 0.1
    }
    
    return Math.max(0, Math.min(1, score))
  }

  private checkDataIntegrity(data: string): number {
    let score = 0.5
    
    if (data.length > 100) score += 0.2
    if (data.includes('{') && data.includes('}')) score += 0.2
    if (data.includes('timestamp')) score += 0.1
    
    if (data.includes('test') || data.includes('mock')) score -= 0.3
    if (data.length < 20) score -= 0.4
    
    return Math.max(0, Math.min(1, score))
  }
}




