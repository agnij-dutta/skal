import { EventEmitter } from 'events'
import { ethers } from 'ethers'
import { AgentOrchestrator, AgentConfig } from './AgentOrchestrator.js'
import { AIDecisionEngine } from '../ai/AIDecisionEngine.js'
import { MarketIntelligence } from '../ai/MarketIntelligence.js'
import { RiskManager } from '../ai/RiskManager.js'
import { StrategyExecutor } from '../ai/StrategyExecutor.js'
import { PerformanceMonitor } from '../ai/PerformanceMonitor.js'

export interface ServiceConfig {
  provider: ethers.JsonRpcProvider
  config: AgentConfig
  orchestrator: AgentOrchestrator
}

export abstract class BaseService extends EventEmitter {
  protected provider: ethers.JsonRpcProvider
  protected config: AgentConfig
  protected orchestrator: AgentOrchestrator
  protected isRunning = false
  protected lastActivity: Date | null = null
  protected errorCount = 0
  protected wallet: ethers.Wallet | null = null
  
  // AI Infrastructure
  protected aiEngine!: AIDecisionEngine
  protected marketIntelligence!: MarketIntelligence
  protected riskManager!: RiskManager
  protected strategyExecutor!: StrategyExecutor
  protected performanceMonitor!: PerformanceMonitor

  constructor(serviceConfig: ServiceConfig) {
    super()
    this.provider = serviceConfig.provider
    this.config = serviceConfig.config
    this.orchestrator = serviceConfig.orchestrator
  }

  /**
   * Set AI infrastructure for the service
   */
  setAIInfrastructure(ai: {
    engine: AIDecisionEngine
    intelligence: MarketIntelligence
    risk: RiskManager
    strategy: StrategyExecutor
    performance: PerformanceMonitor
  }): void {
    this.aiEngine = ai.engine
    this.marketIntelligence = ai.intelligence
    this.riskManager = ai.risk
    this.strategyExecutor = ai.strategy
    this.performanceMonitor = ai.performance
  }

  abstract start(): Promise<void>
  abstract stop(): Promise<void>

  /**
   * Clean up polling intervals when service stops
   */
  protected cleanupPollingIntervals(): void {
    if ((this as any).pollingIntervals) {
      (this as any).pollingIntervals.forEach((interval: NodeJS.Timeout) => {
        clearInterval(interval)
      })
      ;(this as any).pollingIntervals = []
    }
  }

  protected async initializeWallet(privateKey: string): Promise<void> {
    this.wallet = new ethers.Wallet(privateKey, this.provider)
    console.log(`🔑 Wallet initialized: ${this.wallet.address}`)
  }

  protected logActivity(activity: string): void {
    this.lastActivity = new Date()
    console.log(`[${this.constructor.name}] ${activity}`)
    this.emit('activity', { service: this.constructor.name, activity, timestamp: this.lastActivity })
  }

  protected logError(error: Error, context?: string): void {
    this.errorCount++
    const message = context ? `${context}: ${error.message}` : error.message
    console.error(`[${this.constructor.name}] ❌ ${message}`)
    this.emit('error', { service: this.constructor.name, error, context, timestamp: new Date() })
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          this.logError(lastError, `Operation failed after ${maxRetries} attempts`)
          throw lastError
        }

        console.log(`[${this.constructor.name}] ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2 // Exponential backoff
      }
    }

    throw lastError!
  }

  /**
   * Safely wrap event listeners using polling instead of filters (Flow EVM doesn't support long-lived filters)
   * Polls for events every 5 seconds instead of using contract.on()
   */
  protected safeEventListener(contract: ethers.Contract, eventName: string, handler: (...args: any[]) => Promise<void> | void): void {
    let lastBlockNumber = 0
    let pollingInterval: NodeJS.Timeout | null = null
    const processedEvents = new Set<string>() // Track processed events to avoid duplicates

    const pollForEvents = async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber()
        const fromBlock = lastBlockNumber || Math.max(0, currentBlock - 100) // Check last 100 blocks initially
        
        // Query events using queryFilter (doesn't rely on filters)
        // Use the event signature directly instead of filters array access
        const eventFragment = contract.interface.getEvent(eventName)
        if (!eventFragment) {
          this.logActivity(`⚠️ Event ${eventName} not found in contract interface`)
          return
        }
        
        const filter = {
          address: contract.target,
          topics: [contract.interface.getEvent(eventName)!.topicHash]
        }
        const events = await this.provider.getLogs({
          ...filter,
          fromBlock,
          toBlock: currentBlock
        })
        
        // Parse events using contract interface and pair with logs
        const eventLogPairs = events.map((log) => {
          try {
            const parsed = contract.interface.parseLog(log)
            return { log, parsed }
          } catch {
            return null
          }
        }).filter((e): e is { log: ethers.Log; parsed: ethers.LogDescription } => e !== null)
        
        for (const { log, parsed: parsedEvent } of eventLogPairs) {
          // Create unique event ID from transaction hash and log index
          const eventId = `${log.transactionHash}-${log.index}`
          
          if (!processedEvents.has(eventId)) {
            processedEvents.add(eventId)
            
            // Extract event args and call handler
            try {
              const args = parsedEvent.args ? [...parsedEvent.args] : []
              // Create a mock event object that matches what contract.on() would provide
              const mockEvent = {
                ...log,
                args: parsedEvent.args,
                event: parsedEvent.name,
                eventSignature: parsedEvent.signature,
                decode: () => parsedEvent.args
              }
              await handler(...args, mockEvent)
            } catch (error) {
              // Don't let event handler errors crash the system
              this.logActivity(`⚠️ Event handler error for ${eventName}: ${(error as Error).message}`)
            }
          }
        }
        
        lastBlockNumber = currentBlock
        
        // Clean up old processed events (keep last 1000)
        if (processedEvents.size > 1000) {
          const entries = Array.from(processedEvents)
          entries.slice(0, entries.length - 1000).forEach(id => processedEvents.delete(id))
        }
      } catch (error) {
        // Silently handle polling errors (filter expiration, network issues, etc.)
        const err = error as any
        if (err.code !== 'UNKNOWN_ERROR' && !err.message?.includes('filter')) {
          this.logActivity(`⚠️ Polling error for ${eventName}: ${err.message || err}`)
        }
      }
    }

    // Start polling immediately, then every 5 seconds
    pollForEvents()
    pollingInterval = setInterval(pollForEvents, 5000)

    // Store interval so it can be cleaned up
    if (!(this as any).pollingIntervals) {
      (this as any).pollingIntervals = []
    }
    (this as any).pollingIntervals.push(pollingInterval)
  }

  protected async waitForTransaction(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      this.logActivity(`Waiting for transaction: ${txHash}`)
      const receipt = await this.provider.waitForTransaction(txHash, 1, 30000) // 30 second timeout
      
      if (receipt?.status === 1) {
        this.logActivity(`Transaction confirmed: ${txHash}`)
        return receipt
      } else {
        this.logActivity(`⚠️ Transaction ${txHash} failed - this is normal for some operations`)
        return null
      }
    } catch (error) {
      // Don't emit unhandled errors for transaction timeouts or failures
      const errorMessage = (error as Error).message
      if (errorMessage.includes('timeout') || errorMessage.includes('replacement') || errorMessage.includes('failed')) {
        this.logActivity(`Transaction ${txHash} timed out or failed - this is normal`)
        return null
      }
      this.logActivity(`⚠️ Transaction ${txHash} error: ${errorMessage}`)
      return null
    }
  }

  protected async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData()
      return feeData.gasPrice || BigInt(0)
    } catch (error) {
      this.logError(error as Error, 'Failed to get gas price')
      return BigInt(20000000000) // 20 gwei fallback
    }
  }

  protected async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    try {
      return await this.provider.estimateGas(transaction)
    } catch (error) {
      this.logError(error as Error, 'Failed to estimate gas')
      return BigInt(100000) // Fallback gas limit
    }
  }

  // Health check
  getHealthStatus(): { running: boolean; lastActivity: Date | null; errorCount: number } {
    return {
      running: this.isRunning,
      lastActivity: this.lastActivity,
      errorCount: this.errorCount
    }
  }
}
