/**
 * Chain configuration interface
 */
export interface ChainConfig {
  chainId: string | number
  name: string
  rpcUrl: string
  nativeCurrency: {
    symbol: string
    decimals: number
  }
  contracts: {
    commitRegistry: string
    escrowManager: string
    ammEngine: string
    reputationManager: string
    agentRegistry: string
  }
}

/**
 * Base adapter interface for chain-specific implementations
 */
export interface ChainAdapter {
  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>

  /**
   * Commit a signal/task
   */
  commitSignal(commitHash: string, marketId: number, stake: string): Promise<string>

  /**
   * Reveal a signal/task
   */
  revealSignal(signalId: number, cid: string, revealedData: string): Promise<boolean>

  /**
   * Lock funds for purchase
   */
  lockFunds(signalId: number, provider: string, amount: string): Promise<boolean>

  /**
   * Buy signal from AMM
   */
  buySignal(signalId: number, amountIn: string): Promise<any>

  /**
   * Add liquidity to AMM
   */
  addLiquidity(marketId: number, amountA: string, amountB: string): Promise<any>

  /**
   * Listen for events
   */
  on(eventName: string, callback: (data: any) => void): void

  /**
   * Get chain configuration
   */
  getConfig(): ChainConfig
}
