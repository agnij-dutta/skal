import { EventEmitter } from 'events'

/**
 * Base Agent class for all Shadow Protocol agents
 * Provides core functionality shared across all agent types
 */
export abstract class Agent extends EventEmitter {
  protected chainAdapter: any
  protected agentConfig: any
  protected isRunning: boolean = false
  protected agentId: string

  constructor(chainAdapter: any, config: any) {
    super()
    this.chainAdapter = chainAdapter
    this.agentConfig = config
    this.agentId = `${this.constructor.name}-${Date.now()}`
  }

  /**
   * Initialize the agent
   */
  abstract initialize(): Promise<void>

  /**
   * Start the agent
   */
  abstract start(): Promise<void>

  /**
   * Stop the agent gracefully
   */
  abstract stop(): Promise<void>

  /**
   * Process an event (implemented by subclasses)
   */
  protected abstract processEvent(event: any): Promise<void>

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.isRunning
  }

  /**
   * Get agent configuration
   */
  getConfig(): any {
    return this.agentConfig
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.agentId
  }
}
