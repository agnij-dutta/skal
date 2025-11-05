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

  protected async ensureFunding(address: string): Promise<void> {
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
        // Queue funding to prevent nonce collisions - wait for previous to complete
        BaseService.fundingQueue = BaseService.fundingQueue.then(async () => {
          // Wait for any in-flight funding to complete
          await BaseService.fundingLock
          // Start new funding transaction
          const fundingPromise = this.fundViaWallet(fundingPk, address, desiredEth)
          BaseService.fundingLock = fundingPromise
          await fundingPromise
          await this.waitForBalance(address, minEth, 6)
          console.log(`[${this.constructor.name}] ✅ Funded ${address} from funding wallet`)
        }).catch((e) => {
          console.log(`[${this.constructor.name}] ❌ Funding queue error: ${(e as Error).message}`)
          throw e
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
        // Try to get revert reason
        const reason = await this.getRevertReasonFromReceipt(txHash, receipt)
        this.logError(new Error(`Transaction failed: ${reason}`), `Transaction ${txHash} failed`)
      }
      
      return receipt
    } catch (error) {
      this.logError(error as Error, `Error waiting for transaction ${txHash}`)
      return null
    }
  }

  protected decodeRevertReason(error: any): string {
    if (error.reason) return error.reason
    if (error.data) {
      try {
        // Try to decode as string (Error(string) selector is 0x08c379a0)
        if (error.data.startsWith('0x08c379a0')) {
          const reason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + error.data.slice(10))
          return reason[0]
        }
        // Try UTF-8 decode
        if (error.data.length > 138) {
          return ethers.toUtf8String(error.data.slice(138))
        }
      } catch {}
    }
    return error.shortMessage || error.message || String(error)
  }

  protected async getRevertReasonFromReceipt(txHash: string, receipt: ethers.TransactionReceipt | null): Promise<string> {
    if (!receipt || receipt.status === 1) return 'Unknown'
    
    let tx: ethers.TransactionResponse | null = null
    
    try {
      // Get the transaction to see if we can call it
      tx = await this.provider.getTransaction(txHash)
      if (!tx) return 'Transaction not found'
      
      // Try multiple approaches to get revert reason
      
      // Approach 1: Call at the block where it failed
      try {
        const blockTag = receipt.blockNumber > 0 ? receipt.blockNumber : 'latest'
        await this.provider.call({
          ...tx,
          blockTag
        } as any)
      } catch (callError: any) {
        const reason = this.decodeRevertReason(callError)
        if (reason && reason !== 'Unknown' && !reason.includes('unknown')) {
          return reason
        }
      }
      
      // Approach 2: Try calling at previous block
      try {
        const blockTag = receipt.blockNumber > 0 ? receipt.blockNumber - 1 : 'latest'
        await this.provider.call({
          ...tx,
          blockTag
        } as any)
      } catch (callError: any) {
        const reason = this.decodeRevertReason(callError)
        if (reason && reason !== 'Unknown' && !reason.includes('unknown')) {
          return reason
        }
      }
      
      // Approach 3: Try to decode from receipt logs (if there are any revert events)
      if (receipt.logs && receipt.logs.length > 0) {
        // Some contracts emit revert events, but we'd need the ABI to decode them
        // For now, just note that there are logs
      }
      
    } catch {}
    
    // If we can't decode, check common revert reasons
    if (tx && tx.value) {
      try {
        const balance = await this.provider.getBalance(tx.from)
        if (balance < tx.value) {
          return `Insufficient balance: have ${ethers.formatEther(balance)} STT, need ${ethers.formatEther(tx.value)} STT`
        }
      } catch {}
    }
    
    return 'Transaction reverted (reason unknown - may be require(false) or custom revert)'
  }

  /**
   * Parse JSON from AI response that might be wrapped in markdown code blocks
   */
  protected parseJSONFromAIResponse(text: string): any {
    try {
      // First try direct JSON parse
      return JSON.parse(text)
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim())
        } catch {}
      }
      
      // Try to find JSON object in text
      const jsonObjMatch = text.match(/\{[\s\S]*\}/)
      if (jsonObjMatch) {
        try {
          return JSON.parse(jsonObjMatch[0])
        } catch {}
      }
      
      // Try to parse as escaped JSON string
      try {
        const unescaped = text.replace(/\\"/g, '"').replace(/\\n/g, '\n')
        return JSON.parse(unescaped)
      } catch {}
      
      throw new Error('Could not parse JSON from AI response')
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
