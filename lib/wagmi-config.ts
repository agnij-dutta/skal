import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { CONTRACT_ADDRESSES, FLOW_EVM_CONTRACT_ADDRESSES, somniaTestnet, flowEVMTestnet } from './somnia-config'
import { COMMIT_REGISTRY_ABI } from './contracts/abis/commitRegistry'
import { ESCROW_MANAGER_ABI } from './contracts/abis/escrowManager'
import { AMM_ENGINE_ABI } from './contracts/abis/ammEngine'
import { REPUTATION_MANAGER_ABI } from './contracts/abis/reputationManager'
import { AGENT_REGISTRY_ABI } from './contracts/abis/agentRegistry'

export const config = createConfig({
  chains: [somniaTestnet, flowEVMTestnet, mainnet, sepolia],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id',
    }),
  ],
  transports: {
    [somniaTestnet.id]: http(),
    [flowEVMTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

// Contract addresses for easy access
export const contracts = {
  commitRegistry: {
    address: CONTRACT_ADDRESSES.COMMIT_REGISTRY as `0x${string}`,
    abi: COMMIT_REGISTRY_ABI,
  },
  escrowManager: {
    address: CONTRACT_ADDRESSES.ESCROW_MANAGER as `0x${string}`,
    abi: ESCROW_MANAGER_ABI,
  },
  ammEngine: {
    address: CONTRACT_ADDRESSES.AMM_ENGINE as `0x${string}`,
    abi: AMM_ENGINE_ABI,
  },
  reputationManager: {
    address: CONTRACT_ADDRESSES.REPUTATION_MANAGER as `0x${string}`,
    abi: REPUTATION_MANAGER_ABI,
  },
  agentRegistry: {
    address: CONTRACT_ADDRESSES.AGENT_REGISTRY as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
  },
} as const

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
