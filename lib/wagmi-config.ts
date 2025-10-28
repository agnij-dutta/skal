import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { flowEvmTestnet, CONTRACT_ADDRESSES_FLOW } from './flow-config'
import { COMMIT_REGISTRY_ABI } from './contracts/abis/commitRegistry'
import { ESCROW_MANAGER_ABI } from './contracts/abis/escrowManager'
import { AMM_ENGINE_ABI } from './contracts/abis/ammEngine'
import { REPUTATION_MANAGER_ABI } from './contracts/abis/reputationManager'
import { AGENT_REGISTRY_ABI } from './contracts/abis/agentRegistry'

export const config = createConfig({
  chains: [flowEvmTestnet, mainnet, sepolia],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id',
    }),
  ],
  transports: {
    [flowEvmTestnet.id]: http(flowEvmTestnet.rpcUrls.default.http[0]),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

// Contract addresses - only Flow EVM now
export const contracts = {
  commitRegistry: {
    address: CONTRACT_ADDRESSES_FLOW.COMMIT_REGISTRY as `0x${string}`,
    abi: COMMIT_REGISTRY_ABI,
  },
  escrowManager: {
    address: CONTRACT_ADDRESSES_FLOW.ESCROW_MANAGER as `0x${string}`,
    abi: ESCROW_MANAGER_ABI,
  },
  ammEngine: {
    address: CONTRACT_ADDRESSES_FLOW.AMM_ENGINE as `0x${string}`,
    abi: AMM_ENGINE_ABI,
  },
  reputationManager: {
    address: CONTRACT_ADDRESSES_FLOW.REPUTATION_MANAGER as `0x${string}`,
    abi: REPUTATION_MANAGER_ABI,
  },
  agentRegistry: {
    address: CONTRACT_ADDRESSES_FLOW.AGENT_REGISTRY as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
  },
} as const

// Export Flow addresses for direct access
export const CONTRACT_ADDRESSES = CONTRACT_ADDRESSES_FLOW

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
