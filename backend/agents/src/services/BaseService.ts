import { EventEmitter } from 'events'
import { ethers } from 'ethers'
import fetch from 'node-fetch'
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
  
  // Static funding queue to prevent nonce collisions
  private static fundingQueue: Promise<void> = Promise.resolve()
  private static fundingLock: Promise<void> = Promise.resolve()
  
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
    
    // Check balance and warn if unfunded
    try {
      const balance = await this.provider.getBalance(this.wallet.address)
      const balanceEth = parseFloat(ethers.formatEther(balance))
      if (balanceEth < 0.01) {
        console.log(`⚠️  [${this.constructor.name}] Wallet ${this.wallet.address} has low balance: ${ethers.formatEther(balance)} STT`)
        console.log(`⚠️  Run 'npm run check:balances' for funding instructions`)
        if (process.env.AUTO_FUND === 'true') {
          console.log(`💧 [${this.constructor.name}] Auto-funding enabled, attempting to fund wallet...`)
          try {
            await this.ensureFunding(this.wallet.address)
          } catch (e) {
            console.log(`⚠️  [${this.constructor.name}] Auto-funding failed: ${(e as Error).message}`)
          }
        }
      }
    } catch (error) {
      // Account might not exist yet - this is expected for new wallets
      console.log(`⚠️  [${this.constructor.name}] Wallet ${this.wallet.address} appears unfunded or account doesn't exist yet`)
      console.log(`⚠️  Run 'npm run check:balances' for funding instructions`)
      if (process.env.AUTO_FUND === 'true') {
        console.log(`💧 [${this.constructor.name}] Auto-funding enabled, attempting to fund wallet...`)
        try {
          await this.ensureFunding(this.wallet.address)
        } catch (e) {
          console.log(`⚠️  [${this.constructor.name}] Auto-funding failed: ${(e as Error).message}`)
        }
      }
    }
  }

  private async ensureFunding(address: string): Promise<void> {
    const minEth = parseFloat(process.env.MIN_FUND_BALANCE_ETH || '0.05')
    const desiredEth = parseFloat(process.env.FUNDING_AMOUNT_ETH || '0.2')
    try {
      const bal = await this.provider.getBalance(address)
      if (parseFloat(ethers.formatEther(bal)) >= minEth) return
    } catch {}

    // Try faucet first if configured
    const faucetUrl = process.env.SOMNIA_FAUCET_URL
    if (faucetUrl) {
      try {
        await this.fundViaFaucet(faucetUrl, address)
        await this.waitForBalance(address, minEth, 6)
        console.log(`[${this.constructor.name}] ✅ Funded ${address} via faucet`)
        return
      } catch (e) {
        console.log(`[${this.constructor.name}] ⚠️  Faucet funding failed: ${(e as Error).message}`)
      }
    }

    // Fallback to local funding wallet (sequential to avoid nonce collisions)
    const fundingPk = process.env.FUNDING_PK
    if (fundingPk) {
      try {
        // Queue funding to prevent nonce collisions
        BaseService.fundingQueue = BaseService.fundingQueue.then(async () => {
          await BaseService.fundingLock
          BaseService.fundingLock = this.fundViaWallet(fundingPk, address, desiredEth)
          await BaseService.fundingLock
          await this.waitForBalance(address, minEth, 6)
          console.log(`[${this.constructor.name}] ✅ Funded ${address} from funding wallet`)
        })
        await BaseService.fundingQueue
        return
      } catch (e) {
        console.log(`[${this.constructor.name}] ❌ Local funding failed: ${(e as Error).message}`)
      }
    }
  }

  private async fundViaFaucet(url: string, address: string): Promise<void> {
    // Common faucet patterns to try
    const patterns = [
      // Pattern 1: POST with address in body
      {
        method: 'POST' as const,
        url: url,
        body: JSON.stringify({ address }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.SOMNIA_FAUCET_API_KEY ? `Bearer ${process.env.SOMNIA_FAUCET_API_KEY}` : ''
        }
      },
      // Pattern 2: POST with address and chainId
      {
        method: 'POST' as const,
        url: url,
        body: JSON.stringify({ address, chainId: 50312 }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.SOMNIA_FAUCET_API_KEY ? `Bearer ${process.env.SOMNIA_FAUCET_API_KEY}` : ''
        }
      },
      // Pattern 3: GET with address as query param
      {
        method: 'GET' as const,
        url: `${url}${url.includes('?') ? '&' : '?'}address=${address}`,
        headers: {}
      },
      // Pattern 4: Stakely-style POST with token
      {
        method: 'POST' as const,
        url: url.replace('/faucet/somnia-somi', '/api/faucet/somnia-somi'),
        body: JSON.stringify({ address }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    ]

    for (const pattern of patterns) {
      try {
        const opts: any = {
          method: pattern.method,
          headers: pattern.headers
        }
        if (pattern.body) {
          opts.body = pattern.body
        }

        const res = await fetch(pattern.url, opts)
        
        // Check for success (200-299) or accepted (202)
        if (res.status >= 200 && res.status < 300) {
          const text = await res.text().catch(() => '')
          // Some faucets return success even if already funded
          if (text.toLowerCase().includes('success') || 
              text.toLowerCase().includes('sent') ||
              text.toLowerCase().includes('claim') ||
              res.status === 200 || res.status === 202) {
            console.log(`[${this.constructor.name}] ✅ Faucet request successful (pattern ${patterns.indexOf(pattern) + 1})`)
            return
          }
        }
        
        // If we get rate limit or already funded, that's okay - wait and retry
        if (res.status === 429 || res.status === 400) {
          const text = await res.text().catch(() => '')
          if (text.toLowerCase().includes('rate limit') || 
              text.toLowerCase().includes('already') ||
              text.toLowerCase().includes('wait')) {
            console.log(`[${this.constructor.name}] ⚠️  Faucet rate limit or already funded, will retry later`)
            throw new Error('Rate limited or already funded')
          }
        }
      } catch (e: any) {
        // Continue to next pattern unless it's a rate limit
        if (e.message?.includes('Rate limit') || e.message?.includes('already')) {
          throw e
        }
        continue
      }
    }
    
    throw new Error('All faucet patterns failed')
  }

  private async fundViaWallet(fundingPk: string, to: string, amountEth: number): Promise<void> {
    const signer = new ethers.Wallet(fundingPk, this.provider)
    const nonce = await this.provider.getTransactionCount(signer.address, 'pending')
    const tx = await signer.sendTransaction({ 
      to, 
      value: ethers.parseEther(amountEth.toString()),
      nonce
    })
    await this.provider.waitForTransaction(tx.hash)
  }

  private async waitForBalance(address: string, minEth: number, attempts: number): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      const bal = await this.provider.getBalance(address)
      if (parseFloat(ethers.formatEther(bal)) >= minEth) return
      await new Promise(r => setTimeout(r, 5000))
    }
    throw new Error('Balance did not arrive in time')
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
