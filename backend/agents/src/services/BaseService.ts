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

  protected async waitForTransaction(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      this.logActivity(`Waiting for transaction: ${txHash}`)
      const receipt = await this.provider.waitForTransaction(txHash)
      
      if (receipt?.status === 1) {
        this.logActivity(`Transaction confirmed: ${txHash}`)
      } else {
        this.logError(new Error('Transaction failed'), `Transaction ${txHash} failed`)
      }
      
      return receipt
    } catch (error) {
      this.logError(error as Error, `Error waiting for transaction ${txHash}`)
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
