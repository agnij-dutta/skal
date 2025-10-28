/**
 * Skal Agents SDK
 * 
 * A plug-and-play SDK for building intelligence signal trading agents
 * on Flow blockchain with Flow Actions and Scheduled Transactions support
 */

// Core
export { Agent } from './core/Agent'

// Chains
export { FlowAdapter } from './chains/FlowAdapter'
export { EVMAdapter } from './chains/EVMAdapter'
export type { ChainAdapter, ChainConfig } from './chains/ChainConfig'

// AI
export { AIDecisionEngine } from './ai/AIDecisionEngine'
export { MarketIntelligence } from './ai/MarketIntelligence'
export { RiskManager } from './ai/RiskManager'
export { StrategyExecutor } from './ai/StrategyExecutor'

// Utils
export * from './utils/crypto-utils'
export * from './utils/storage-client'

// Re-export common types
export type { EventEmitter } from 'events'
