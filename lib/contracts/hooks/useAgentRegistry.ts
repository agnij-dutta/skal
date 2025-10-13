'use client'

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { AGENT_REGISTRY_ABI } from '../abis/agentRegistry'
import { CONTRACT_ADDRESSES } from '../../somnia-config'

const AGENT_REGISTRY_ADDRESS = CONTRACT_ADDRESSES.AGENT_REGISTRY as `0x${string}`

export enum AgentType {
  Provider = 0,
  Buyer = 1,
  Verifier = 2,
  LP = 3,
  MultiRole = 4,
}

export interface Agent {
  agentAddress: `0x${string}`
  agentType: AgentType
  name: string
  description: string
  endpoint: string
  publicKey: `0x${string}`
  stakeAmount: bigint
  active: boolean
  registeredAt: bigint
  lastActivity: bigint
}

export function useRegisterAgent() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const registerAgent = async (
    agentAddress: `0x${string}`,
    agentType: AgentType,
    name: string,
    description: string,
    endpoint: string,
    publicKey: `0x${string}`,
    stakeAmount: string
  ) => {
    const stake = parseEther(stakeAmount)
    
    return writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'registerAgent',
      args: [agentAddress, agentType, name, description, endpoint, publicKey],
      value: stake,
    })
  }

  return {
    registerAgent,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useUpdateAgent() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const updateAgent = async (
    name: string,
    description: string,
    endpoint: string
  ) => {
    return writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'updateAgent',
      args: [name, description, endpoint],
    })
  }

  return {
    updateAgent,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useUpdateMetadata() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const updateMetadata = async (key: string, value: string) => {
    return writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'updateMetadata',
      args: [key, value],
    })
  }

  return {
    updateMetadata,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useDeactivateAgent() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const deactivateAgent = async (agentAddress: `0x${string}`) => {
    return writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'deactivateAgent',
      args: [agentAddress],
    })
  }

  return {
    deactivateAgent,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useReactivateAgent() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const reactivateAgent = async (agentAddress: `0x${string}`) => {
    return writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'reactivateAgent',
      args: [agentAddress],
    })
  }

  return {
    reactivateAgent,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useUpdateStake() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const updateStake = async (agentAddress: `0x${string}`, newStake: string) => {
    const stake = parseEther(newStake)
    
    return writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'updateStake',
      args: [agentAddress, stake],
    })
  }

  return {
    updateStake,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useGetAgent(agentAddress: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getAgent',
    args: agentAddress ? [agentAddress] : undefined,
    query: {
      enabled: !!agentAddress,
    },
  })

  return {
    agent: data as Agent | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetAgentMetadata(agentAddress: `0x${string}` | undefined, key: string | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getAgentMetadata',
    args: agentAddress && key ? [agentAddress, key] : undefined,
    query: {
      enabled: !!agentAddress && !!key,
    },
  })

  return {
    metadata: data as string | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetAgentsByType(agentType: AgentType | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getAgentsByType',
    args: agentType !== undefined ? [agentType] : undefined,
    query: {
      enabled: agentType !== undefined,
    },
  })

  return {
    agents: data as `0x${string}`[] | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetAllAgents() {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getAllAgents',
  })

  return {
    agents: data as `0x${string}`[] | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetActiveAgentsByType(agentType: AgentType | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getActiveAgentsByType',
    args: agentType !== undefined ? [agentType] : undefined,
    query: {
      enabled: agentType !== undefined,
    },
  })

  return {
    agents: data as `0x${string}`[] | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useIsAgentActive(agentAddress: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'isAgentActive',
    args: agentAddress ? [agentAddress] : undefined,
    query: {
      enabled: !!agentAddress,
    },
  })

  return {
    isActive: data as boolean | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetTotalAgentCount() {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getTotalAgentCount',
  })

  return {
    totalCount: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetAgentCountByType(agentType: AgentType | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getAgentCountByType',
    args: agentType !== undefined ? [agentType] : undefined,
    query: {
      enabled: agentType !== undefined,
    },
  })

  return {
    count: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  }
}
