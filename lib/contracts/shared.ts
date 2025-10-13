// Shared contract types and utilities for both frontend and backend
export * from './abis/commitRegistry'
export * from './abis/escrowManager'
export * from './abis/ammEngine'
export * from './abis/reputationManager'
export * from './abis/agentRegistry'
export * from './abis/lpToken'

// Re-export all event types
export * from './events'

// Contract addresses (from deployment.json)
export const CONTRACT_ADDRESSES = {
  COMMIT_REGISTRY: '0xB94ecC5a4cA8D7D2749cE8353F03B38372235C26',
  ESCROW_MANAGER: '0x8F9Cce60CDa5c3b262c30321f40a180A6A9DA762',
  AMM_ENGINE: '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC',
  REPUTATION_MANAGER: '0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8',
  AGENT_REGISTRY: '0x2CC077f1Da27e7e08A1832804B03b30A2990a61C',
} as const

// Network configuration
export const SOMNIA_TESTNET = {
  chainId: 1946,
  name: 'Somnia Testnet',
  rpcUrl: 'https://dream-rpc.somnia.network/',
  blockExplorer: 'https://explorer.somnia.network/',
} as const

// Common types used across frontend and backend
export interface ContractConfig {
  rpcUrl: string
  contractAddresses: typeof CONTRACT_ADDRESSES
}

export interface AgentConfig extends ContractConfig {
  storageUrl: string
  privateKey: string
  marketConfig: {
    marketId: number
    stakeAmount: string
    buyAmount: string
    lpAmountA: string
    lpAmountB: string
  }
}
