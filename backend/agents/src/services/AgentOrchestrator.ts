import { EventEmitter } from 'events'
import { ethers } from 'ethers'
import dotenv from 'dotenv'
import { ProviderService } from './ProviderService.js'
import { BuyerService } from './BuyerService.js'
import { VerifierService } from './VerifierService.js'
import { LPService } from './LPService.js'

dotenv.config()

export interface AgentConfig {
  rpcUrl: string
  storageUrl: string
  contractAddresses: {
    commitRegistry: string
    escrowManager: string
    ammEngine: string
    reputationManager: string
    agentRegistry: string
  }
  agentKeys: {
    provider: string
    buyer: string
    verifier: string
    lp: string
  }
  marketConfig: {
    marketId: number
    stakeAmount: string
    buyAmount: string
    lpAmountA: string
    lpAmountB: string
  }
}

export class AgentOrchestrator extends EventEmitter {
  private provider: ethers.JsonRpcProvider
  private services: Map<string, any> = new Map()
  private isRunning = false
  private config: AgentConfig

  constructor(config: AgentConfig) {
    super()
    this.config = config
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('AgentOrchestrator is already running')
      return
    }

    console.log('🚀 Starting Shadow Protocol Agent Orchestrator...')
    this.isRunning = true

    try {
      // Initialize all services
      await this.initializeServices()
      
      // Start all services
      await this.startServices()
      
      // Setup graceful shutdown
      this.setupGracefulShutdown()
      
      console.log('✅ All agent services started successfully')
      this.emit('started')
      
    } catch (error) {
      console.error('❌ Failed to start agent orchestrator:', error)
      this.emit('error', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('AgentOrchestrator is not running')
      return
    }

    console.log('🛑 Stopping Shadow Protocol Agent Orchestrator...')
    this.isRunning = false

    try {
      // Stop all services
      for (const [name, service] of this.services) {
        console.log(`Stopping ${name} service...`)
        if (service.stop) {
          await service.stop()
        }
      }
      
      this.services.clear()
      console.log('✅ All agent services stopped successfully')
      this.emit('stopped')
      
    } catch (error) {
      console.error('❌ Error stopping agent orchestrator:', error)
      this.emit('error', error)
    }
  }

  private async initializeServices(): Promise<void> {
    console.log('🔧 Initializing agent services...')

    // Initialize Provider Service
    const providerService = new ProviderService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    this.services.set('provider', providerService)

    // Initialize Buyer Service
    const buyerService = new BuyerService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    this.services.set('buyer', buyerService)

    // Initialize Verifier Service
    const verifierService = new VerifierService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    this.services.set('verifier', verifierService)

    // Initialize LP Service
    const lpService = new LPService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    this.services.set('lp', lpService)

    console.log('✅ All services initialized')
  }

  private async startServices(): Promise<void> {
    console.log('🏃 Starting agent services...')

    for (const [name, service] of this.services) {
      console.log(`Starting ${name} service...`)
      if (service.start) {
        await service.start()
      }
    }

    console.log('✅ All services started')
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`)
      await this.stop()
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGUSR2', () => shutdown('SIGUSR2')) // For nodemon
  }

  // Service management methods
  getService(name: string): any {
    return this.services.get(name)
  }

  getAllServices(): Map<string, any> {
    return new Map(this.services)
  }

  isServiceRunning(name: string): boolean {
    const service = this.services.get(name)
    return service && service.isRunning
  }

  // Health check
  async healthCheck(): Promise<{ status: string; services: Record<string, any> }> {
    const services: Record<string, any> = {}
    
    for (const [name, service] of this.services) {
      services[name] = {
        running: this.isServiceRunning(name),
        lastActivity: service.lastActivity || null,
        errorCount: service.errorCount || 0
      }
    }

    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      services
    }
  }

  // Event forwarding
  forwardEvent(eventName: string, data: any): void {
    this.emit(eventName, data)
  }
}
