'use client'

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { REPUTATION_MANAGER_ABI } from '../abis/reputationManager'
import { CONTRACT_ADDRESSES_FLOW as CONTRACT_ADDRESSES } from '../../flow-config'

const REPUTATION_MANAGER_ADDRESS = CONTRACT_ADDRESSES.REPUTATION_MANAGER as `0x${string}`

export interface Reputation {
  score: bigint
  totalTasks: bigint
  successfulTasks: bigint
  disputedTasks: bigint
  stakeAmount: bigint
  lastUpdate: bigint
  active: boolean
}

export interface Stake {
  amount: bigint
  timestamp: bigint
  locked: boolean
  unlockTime: bigint
}

export function useDepositStake() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const depositStake = async (user: `0x${string}`, amount: string) => {
    const value = parseEther(amount)
    
    return writeContract({
      address: REPUTATION_MANAGER_ADDRESS,
      abi: REPUTATION_MANAGER_ABI,
      functionName: 'depositStake',
      args: [user],
      value,
    })
  }

  return {
    depositStake,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useWithdrawStake() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const withdrawStake = async (amount: string) => {
    const amountWei = parseEther(amount)
    
    return writeContract({
      address: REPUTATION_MANAGER_ADDRESS,
      abi: REPUTATION_MANAGER_ABI,
      functionName: 'withdrawStake',
      args: [amountWei],
    })
  }

  return {
    withdrawStake,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useUnlockStake() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const unlockStake = async () => {
    return writeContract({
      address: REPUTATION_MANAGER_ADDRESS,
      abi: REPUTATION_MANAGER_ABI,
      functionName: 'unlockStake',
    })
  }

  return {
    unlockStake,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useUpdateReputation() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const updateReputation = async (
    user: `0x${string}`,
    success: boolean,
    disputed: boolean
  ) => {
    return writeContract({
      address: REPUTATION_MANAGER_ADDRESS,
      abi: REPUTATION_MANAGER_ABI,
      functionName: 'updateReputation',
      args: [user, success, disputed],
    })
  }

  return {
    updateReputation,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useSlashStake() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const slashStake = async (user: `0x${string}`, reason: string) => {
    return writeContract({
      address: REPUTATION_MANAGER_ADDRESS,
      abi: REPUTATION_MANAGER_ABI,
      functionName: 'slashStake',
      args: [user, reason],
    })
  }

  return {
    slashStake,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useGetReputation(user: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    functionName: 'getReputation',
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  })

  return {
    reputation: data as Reputation | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetStake(user: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    functionName: 'getStake',
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  })

  return {
    stake: data as Stake | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetReputationScore(user: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    functionName: 'getReputation',
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  })

  return {
    reputation: data as Reputation | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useCanPerformAction(user: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    functionName: 'canPerformAction',
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  })

  return {
    canPerformAction: data as boolean | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetRequiredStake(user: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    functionName: 'getRequiredStake',
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  })

  return {
    requiredStake: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  }
}
