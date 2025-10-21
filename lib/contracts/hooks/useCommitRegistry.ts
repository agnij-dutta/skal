'use client'

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useMemo } from 'react'
import { parseEther, encodeFunctionData } from 'viem'
import { COMMIT_REGISTRY_ABI } from '../abis/commitRegistry'
import { CONTRACT_ADDRESSES } from '../../somnia-config'

const COMMIT_REGISTRY_ADDRESS = CONTRACT_ADDRESSES.COMMIT_REGISTRY as `0x${string}`

export interface Task {
  commitHash: `0x${string}`
  provider: `0x${string}`
  marketId: bigint
  stake: bigint
  timestamp: bigint
  state: number // 0=Committed, 1=Revealed, 2=Validated, 3=Settled, 4=Disputed, 5=Cancelled
  cid: string
  validationScore: number
  verifier: `0x${string}`
  revealDeadline: bigint
  validationDeadline: bigint
}

export function useCommitTask() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({
    hash,
  })

  const commitTask = async (
    commitHash: `0x${string}`,
    marketId: number,
    stakeAmount: string
  ) => {
    const stake = parseEther(stakeAmount)
    
    return writeContract({
      address: COMMIT_REGISTRY_ADDRESS,
      abi: COMMIT_REGISTRY_ABI,
      functionName: 'commitTask',
      args: [commitHash, BigInt(marketId), stake],
      value: stake,
    })
  }

  return {
    commitTask,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    receipt,
    isLoading: isPending || isConfirming,
  }
}

export function useRevealTask() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const revealTask = async (taskId: number, cid: string) => {
    return writeContract({
      address: COMMIT_REGISTRY_ADDRESS,
      abi: COMMIT_REGISTRY_ABI,
      functionName: 'revealTask',
      args: [BigInt(taskId), cid],
    })
  }

  return {
    revealTask,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useFinalizeValidation() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const finalizeValidation = async (
    taskId: number,
    score: number,
    verifier: `0x${string}`,
    signature: `0x${string}`
  ) => {
    return writeContract({
      address: COMMIT_REGISTRY_ADDRESS,
      abi: COMMIT_REGISTRY_ABI,
      functionName: 'finalizeValidation',
      args: [BigInt(taskId), score, verifier, signature],
    })
  }

  return {
    finalizeValidation,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useGetTask(taskId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'getTask',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  return {
    task: data as Task | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetProviderTasks(provider: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'getProviderTasks',
    args: provider ? [provider] : undefined,
    query: {
      enabled: !!provider,
    },
  })

  return {
    taskIds: data as bigint[] | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetMarketTasks(marketId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'getMarketTasks',
    args: marketId !== undefined ? [BigInt(marketId)] : undefined,
    query: {
      enabled: marketId !== undefined,
    },
  })

  return {
    taskIds: data as bigint[] | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetDetailedTasks(taskIds: bigint[] | undefined) {
  const tasks = useMemo(() => {
    if (!taskIds || taskIds.length === 0) return []
    
    return taskIds.map(taskId => {
      // This would ideally use a batch read, but for now we'll return the taskId
      // In a real implementation, you'd want to batch these reads
      return {
        taskId: Number(taskId),
        isLoading: true, // Will be loaded individually
      }
    })
  }, [taskIds])

  return {
    tasks,
    isLoading: false,
    error: null,
  }
}

export function useGetTotalTasks() {
  const { data, error, isLoading, refetch } = useReadContract({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'getTotalTasks',
  })

  return {
    totalTasks: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useCanReveal(taskId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'canReveal',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  return {
    canReveal: data as boolean | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useCanValidate(taskId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'canValidate',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  return {
    canValidate: data as boolean | undefined,
    error,
    isLoading,
    refetch,
  }
}
