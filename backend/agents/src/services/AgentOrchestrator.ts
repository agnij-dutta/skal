import { EventEmitter } from 'events'
import { ethers } from 'ethers'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { ProviderService } from './ProviderService.js'
import { BuyerService } from './BuyerService.js'
import { VerifierService } from './VerifierService.js'
import { LPService } from './LPService.js'
import { OracleNodeService } from './OracleNodeService.js'
import { AIDecisionEngine } from '../ai/AIDecisionEngine.js'
import { MarketIntelligence } from '../ai/MarketIntelligence.js'
import { RiskManager } from '../ai/RiskManager.js'
import { StrategyExecutor } from '../ai/StrategyExecutor.js'
import { PerformanceMonitor } from '../ai/PerformanceMonitor.js'

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
    oracleRegistry: string
    verificationAggregator: string
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
  private webServer: any = null
  
  // AI Infrastructure
  private aiEngine!: AIDecisionEngine
  private marketIntelligence!: MarketIntelligence
  private riskManager!: RiskManager
  private strategyExecutor!: StrategyExecutor
  private performanceMonitor!: PerformanceMonitor

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
      // Initialize AI infrastructure first
      await this.initializeAIInfrastructure()
      
      // Initialize all services
      await this.initializeServices()
      
      // Start all services
      await this.startServices()
      
      // Start performance monitoring
      this.startPerformanceMonitoring()
      
      // Start web server on port 8000
      this.startWebServer()
      
      // Setup graceful shutdown
      this.setupGracefulShutdown()
      
      console.log('✅ All agent services started successfully')
      console.log('🌐 Web server running on http://localhost:8000')
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
      // Stop web server
      if (this.webServer) {
        this.webServer.close()
        console.log('🌐 Web server stopped')
      }
      
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

  private async initializeAIInfrastructure(): Promise<void> {
    console.log('🧠 Initializing AI Infrastructure...')
    
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }
    
    this.aiEngine = new AIDecisionEngine({
      geminiApiKey,
      provider: this.provider,
      config: this.config
    })
    
    this.marketIntelligence = new MarketIntelligence({
      provider: this.provider,
      contracts: this.config.contractAddresses
    })
    
    this.riskManager = new RiskManager({
      aiEngine: this.aiEngine,
      marketIntelligence: this.marketIntelligence
    })
    
    this.strategyExecutor = new StrategyExecutor({
      provider: this.provider,
      riskManager: this.riskManager
    })
    
    this.performanceMonitor = new PerformanceMonitor({
      aiEngine: this.aiEngine
    })
    
    console.log('✅ AI Infrastructure initialized')
  }

  private async initializeServices(): Promise<void> {
    console.log('🔧 Initializing agent services...')

    // Initialize Provider Service
    const providerService = new ProviderService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    providerService.setAIInfrastructure({
      engine: this.aiEngine,
      intelligence: this.marketIntelligence,
      risk: this.riskManager,
      strategy: this.strategyExecutor,
      performance: this.performanceMonitor
    })
    this.services.set('provider', providerService)

    // Initialize Buyer Service
    const buyerService = new BuyerService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    buyerService.setAIInfrastructure({
      engine: this.aiEngine,
      intelligence: this.marketIntelligence,
      risk: this.riskManager,
      strategy: this.strategyExecutor,
      performance: this.performanceMonitor
    })
    this.services.set('buyer', buyerService)

    // Initialize Verifier Service
    const verifierService = new VerifierService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    verifierService.setAIInfrastructure({
      engine: this.aiEngine,
      intelligence: this.marketIntelligence,
      risk: this.riskManager,
      strategy: this.strategyExecutor,
      performance: this.performanceMonitor
    })
    this.services.set('verifier', verifierService)

    // Initialize LP Service
    const lpService = new LPService({
      provider: this.provider,
      config: this.config,
      orchestrator: this
    })
    lpService.setAIInfrastructure({
      engine: this.aiEngine,
      intelligence: this.marketIntelligence,
      risk: this.riskManager,
      strategy: this.strategyExecutor,
      performance: this.performanceMonitor
    })
    this.services.set('lp', lpService)

    // Always run Oracle nodes in autonomous mode
    console.log('🔮 Initializing Oracle Network...')
    
    // Initialize multiple Oracle Node Services
    const oracleCount = parseInt(process.env.MIN_ORACLES || '3')
    for (let i = 1; i <= oracleCount; i++) {
      const oracleId = i.toString()
      const oracleService = new OracleNodeService({
        provider: this.provider,
        config: this.config,
        orchestrator: this,
        oracleId
      })
      oracleService.setAIInfrastructure({
        engine: this.aiEngine,
        intelligence: this.marketIntelligence,
        risk: this.riskManager,
        strategy: this.strategyExecutor,
        performance: this.performanceMonitor
      })
      this.services.set(`oracle-${oracleId}`, oracleService)
      console.log(`✅ Oracle Node ${oracleId} service initialized`)
    }

    console.log('✅ All services initialized')
  }

  private async startServices(): Promise<void> {
    console.log('🏃 Starting agent services in parallel...')

    const startPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      console.log(`Starting ${name} service...`)
      if (service.start) {
        try {
          await service.start()
          console.log(`✅ ${name} service started successfully`)
        } catch (error) {
          console.error(`❌ Failed to start ${name} service:`, error)
          // Continue with other services even if one fails
        }
      }
    })

    // Start all services in parallel
    await Promise.allSettled(startPromises)

    console.log('✅ All services started (some may have failed)')
  }

  private startPerformanceMonitoring(): void {
    if (process.env.ENABLE_PERFORMANCE_TRACKING === 'true') {
      this.performanceMonitor.start()
      console.log('📊 Performance monitoring started')
    }
  }

  private startWebServer(): void {
    const port = 8000
    
    this.webServer = createServer(async (req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      try {
        if (req.url === '/health' || req.url === '/') {
          const health = await this.healthCheck()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(health, null, 2))
        } else if (req.url === '/status') {
          const status = {
            running: this.isRunning,
            services: Array.from(this.services.keys()),
            timestamp: new Date().toISOString()
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(status, null, 2))
        } else if (req.url === '/oracles') {
          const oracleStatus = await this.getOracleStatus()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(oracleStatus, null, 2))
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not Found' }, null, 2))
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal Server Error' }, null, 2))
      }
    })
    
    this.webServer.listen(port, () => {
      console.log(`🌐 Autonomous Agent Network running on http://localhost:${port}`)
      console.log(`📊 Health check: http://localhost:${port}/health`)
      console.log(`🔮 Oracle status: http://localhost:${port}/oracles`)
    })
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`)
      
      // Stop performance monitoring
      this.performanceMonitor.stop()
      
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

  // Get oracle status
  async getOracleStatus(): Promise<{ oracles: any[]; total: number; active: number }> {
    const oracles: any[] = []
    let activeCount = 0
    
    for (const [name, service] of this.services) {
      if (name.startsWith('oracle-')) {
        const oracleId = name.replace('oracle-', '')
        const isRunning = this.isServiceRunning(name)
        if (isRunning) activeCount++
        
        oracles.push({
          id: oracleId,
          name: `Oracle ${oracleId}`,
          running: isRunning,
          lastActivity: service.lastActivity || null,
          errorCount: service.errorCount || 0
        })
      }
    }
    
    return {
      oracles,
      total: oracles.length,
      active: activeCount
    }
  }
}
