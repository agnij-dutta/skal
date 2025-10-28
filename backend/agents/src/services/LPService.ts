import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { AMM_ENGINE_ABI } from '../../../../lib/contracts/abis/ammEngine.js'
import { Strategy, PricingModel, ArbitrageOpportunity } from '../ai/types.js'

export class LPService extends BaseService {
  private ammEngine: ethers.Contract
  private rebalanceInterval: NodeJS.Timeout | null = null
  private rebalanceIntervalMs: number = 60000 // 1 minute

  constructor(serviceConfig: ServiceConfig) {
    super(serviceConfig)
    this.ammEngine = new ethers.Contract(
      this.config.contractAddresses.ammEngine,
      AMM_ENGINE_ABI,
      this.provider
    )
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('LPService is already running')
      return
    }

    try {
      await this.initializeWallet(this.config.agentKeys.lp)
      this.isRunning = true
      
      this.logActivity('LP service started - ready for autonomous operation')
      
      // Seed initial liquidity if a market is empty
      await this.seedLiquidityIfNeeded()
      
      // Start rebalancing process (will check if liquidity exists before acting)
      this.startRebalancing()
      
      this.logActivity('AI-driven LP agent ready to provide liquidity and rebalance markets')
      
    } catch (error) {
      this.logError(error as Error, 'Failed to start LP service')
      // Don't throw - let other agents continue
      console.log('LP service will retry operations as needed')
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    
    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval)
      this.rebalanceInterval = null
    }

    this.logActivity('LP service stopped')
  }

  private async provideInitialLiquidity(marketIdOverride?: number): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot provide liquidity')
      return
    }

    try {
      this.logActivity('Providing initial liquidity...')
      
      const marketId = marketIdOverride || this.config.marketConfig.marketId
      const amountA = ethers.parseEther(this.config.marketConfig.lpAmountA)
      const amountB = BigInt(this.config.marketConfig.lpAmountB)
      
      const tx = await (this.ammEngine.connect(this.wallet) as any).addLiquidity(
        BigInt(marketId),
        amountA,
        amountB,
        {
          gasLimit: 500000, // Increased gas limit for AMM operations
          value: amountA + amountB // Native-only pool: send both as value
        }
      )

      this.logActivity(`Liquidity added: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Liquidity confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('liquidityAdded', {
          marketId: BigInt(marketId),
          provider: this.wallet!.address,
          amountA,
          amountB,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, 'Failed to provide initial liquidity')
    }
  }

  private startRebalancing(): void {
    this.logActivity('Starting liquidity rebalancing...')
    
    this.rebalanceInterval = setInterval(async () => {
      await this.rebalanceLiquidity()
    }, this.rebalanceIntervalMs)
  }

  private async rebalanceLiquidity(): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot rebalance')
      return
    }

    try {
      this.logActivity('🧠 AI-driven liquidity rebalancing...')
      
      // 1. Analyze all markets
      const allMarkets = [1, 2, 3]
      const marketAnalyses = await Promise.all(
        allMarkets.map(id => this.marketIntelligence.analyzeMarketConditions(id))
      )
      
      // 2. Auto-seed any empty markets before rebalancing
      await this.seedLiquidityIfNeeded()

      // 3. AI determines optimal liquidity distribution
      const strategy = await this.aiEngine.selectStrategy({
        markets: marketAnalyses,
        currentPositions: await this.getCurrentPositions(),
        availableCapital: await this.getAvailableCapital(),
        timestamp: Date.now(),
        globalSentiment: { score: 0.5, trend: 'neutral' }, // Add missing field
        volatility: marketAnalyses[0]?.volatility || 0.2,
        liquidity: marketAnalyses.reduce((sum, m) => sum + (m.liquidity || 0), 0)
      })
      
      // 4. Execute strategy
      for (const action of strategy.actions) {
        switch (action.type) {
          case 'add':
            await this.intelligentAddLiquidity(action.marketId, action.amounts)
            break
          case 'remove':
            await this.intelligentRemoveLiquidity(action.marketId, action.lpTokens)
            break
          case 'rebalance':
            await this.rebalanceBetweenMarkets(action.from, action.to, action.amount)
            break
        }
      }
      
      // 5. Dynamic pricing updates (create pricing models from market analyses)
      const pricingModels = new Map<number, any>()
      for (const analysis of marketAnalyses) {
        pricingModels.set(analysis.marketId, {
          marketId: analysis.marketId,
          basePrice: 1.0,
          volatilityMultiplier: analysis.volatility,
          demandFactor: analysis.liquidity > 1000 ? 1.2 : 0.8,
          reputationBonus: 0,
          lastUpdate: Date.now()
        })
      }
      await this.updateDynamicPricing(pricingModels)
      
      // 6. Detect arbitrage opportunities
      await this.detectAndExecuteArbitrage()
      
    } catch (error) {
      this.logError(error as Error, 'Failed to rebalance liquidity')
    }
  }

  private async addLiquidity(marketId: number): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot add liquidity')
      return
    }

    try {
      // Add smaller amounts for rebalancing
      const amountA = ethers.parseEther('0.1') // 0.1 FLOW
      const amountB = ethers.parseEther('0.1') // 0.1 FLOW equivalent
      
      const tx = await (this.ammEngine.connect(this.wallet) as any).addLiquidity(
        BigInt(marketId),
        amountA,
        amountB,
        {
          gasLimit: 500000, // Increased gas limit for AMM operations
          value: amountA + amountB // Native-only pool: send both as value
        }
      )

      this.logActivity(`Rebalancing liquidity added: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Rebalancing confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('liquidityRebalanced', {
          marketId: BigInt(marketId),
          provider: this.wallet!.address,
          amountA,
          amountB,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to add liquidity to market ${marketId}`)
    }
  }

  private async removeLiquidity(marketId: number, lpTokens: bigint): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot remove liquidity')
      return
    }

    try {
      this.logActivity(`Removing ${ethers.formatEther(lpTokens)} LP tokens from market ${marketId}`)
      
      const tx = await (this.ammEngine.connect(this.wallet) as any).removeLiquidity(
        BigInt(marketId),
        lpTokens,
        {
          gasLimit: 500000 // Increased gas limit for AMM operations
        }
      )

      this.logActivity(`Liquidity removed: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Liquidity removal confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('liquidityRemoved', {
          marketId: BigInt(marketId),
          provider: this.wallet!.address,
          lpTokens,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to remove liquidity from market ${marketId}`)
    }
  }

  // AI-driven helper methods

  private async intelligentAddLiquidity(marketId: number, amounts: { amountA: bigint; amountB: bigint }): Promise<void> {
    // AI-optimized liquidity provision
    const marketData = await this.ammEngine.getMarket(marketId)
    
    // Calculate optimal ratio based on predicted demand
    const prediction = await this.marketIntelligence.predictPriceMovement(marketId)
    const optimizedAmounts = this.localModels.optimizeLiquidityRatio({
      requestedA: amounts.amountA,
      requestedB: amounts.amountB,
      currentReserveA: marketData.reserveA,
      currentReserveB: marketData.reserveB,
      prediction
    })
    
    // Execute with slippage protection
    await this.strategyExecutor.executeStrategy({
      type: 'addLiquidity',
      marketId,
      amounts: optimizedAmounts,
      maxSlippage: 0.01
    })
    
    this.logActivity(`AI-optimized liquidity added to market ${marketId}`)
  }

  private async intelligentRemoveLiquidity(marketId: number, lpTokens: bigint): Promise<void> {
    // AI-determined liquidity removal
    const marketData = await this.ammEngine.getMarket(marketId)
    
    // Calculate optimal removal amount based on market conditions
    const marketAnalysis = await this.marketIntelligence.analyzeMarketConditions(marketId)
    const optimalRemoval = this.calculateOptimalRemoval(lpTokens, marketAnalysis)
    
    await this.strategyExecutor.executeStrategy({
      type: 'removeLiquidity',
      marketId,
      lpTokens: optimalRemoval,
      maxSlippage: 0.01
    })
    
    this.logActivity(`AI-optimized liquidity removed from market ${marketId}`)
  }

  private async rebalanceBetweenMarkets(fromMarket: number, toMarket: number, amount: bigint): Promise<void> {
    // Remove from source market
    await this.intelligentRemoveLiquidity(fromMarket, amount)
    
    // Add to destination market
    await this.intelligentAddLiquidity(toMarket, { amountA: amount, amountB: amount })
    
    this.logActivity(`AI rebalanced ${ethers.formatEther(amount)} from market ${fromMarket} to market ${toMarket}`)
  }

  private async updateDynamicPricing(pricingModels: Map<number, PricingModel>): Promise<void> {
    // Update pricing based on AI analysis
    for (const [marketId, model] of pricingModels) {
      this.logActivity(`Updating pricing for market ${marketId}: volatility=${model.volatilityMultiplier}, demand=${model.demandFactor}`)
      // Pricing updates would be reflected in liquidity adjustments
    }
  }

  private async detectAndExecuteArbitrage(): Promise<void> {
    const opportunities = await this.marketIntelligence.detectArbitrageOpportunities()
    
    for (const opp of opportunities) {
      if (opp.expectedProfit > opp.estimatedCost * 1.5) {
        await this.executeArbitrage(opp)
      }
    }
  }

  private async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    this.logActivity(`Executing arbitrage: ${opportunity.fromMarket} -> ${opportunity.toMarket} | Expected profit: ${opportunity.expectedProfit}`)
    
    // This would implement the actual arbitrage logic
    // For now, just log the opportunity
  }

  private async getCurrentPositions(): Promise<any[]> {
    // Get current LP positions across all markets
    const positions = []
    
    for (const marketId of [1, 2, 3]) {
      try {
        const market = await this.ammEngine.getMarket(marketId)
        if (market.active) {
          positions.push({
            marketId,
            lpTokens: BigInt(0), // Would get actual LP token balance
            value: market.reserveA + market.reserveB,
            entryPrice: Number(market.reserveB) / Number(market.reserveA),
            currentPrice: Number(market.reserveB) / Number(market.reserveA),
            pnl: 0
          })
        }
      } catch (error) {
        this.logError(error as Error, `Failed to get position for market ${marketId}`)
      }
    }
    
    return positions
  }

  private async getAvailableCapital(): Promise<bigint> {
    if (!this.wallet) return 0n
    
    try {
      const balance = await this.provider.getBalance(this.wallet.address)
      return balance
    } catch (error) {
      this.logError(error as Error, 'Failed to get available capital')
      return 0n
    }
  }

  private calculateOptimalRemoval(lpTokens: bigint, marketAnalysis: any): bigint {
    // Calculate optimal removal based on market conditions
    const volatilityFactor = 1 + marketAnalysis.volatility
    const liquidityFactor = Math.min(1, marketAnalysis.liquidity / 10000)
    
    const optimalPercentage = Math.min(0.5, volatilityFactor * liquidityFactor)
    return BigInt(Math.floor(Number(lpTokens) * optimalPercentage))
  }

  private async seedLiquidityIfNeeded(): Promise<void> {
    if (!this.wallet) return
    try {
      for (const marketId of [1, 2, 3]) {
        try {
          const market = await this.ammEngine.getMarket(marketId)
          const total = market.reserveA + market.reserveB
          if (total === 0n) {
            this.logActivity(`Seeding initial liquidity for empty market ${marketId}`)
            await this.provideInitialLiquidity(marketId)
          }
        } catch (err) {
          this.logError(err as Error, `Failed checking liquidity for market ${marketId}`)
        }
      }
    } catch (error) {
      this.logError(error as Error, 'Failed to seed liquidity')
    }
  }
}
