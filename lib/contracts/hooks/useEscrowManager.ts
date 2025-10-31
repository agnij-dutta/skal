'use client'

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { ESCROW_MANAGER_ABI } from '../abis/escrowManager'
import { CONTRACT_ADDRESSES_FLOW as CONTRACT_ADDRESSES, flowEvmTestnet } from '../../flow-config'

const ESCROW_MANAGER_ADDRESS = CONTRACT_ADDRESSES.ESCROW_MANAGER as `0x${string}`

export interface Escrow {
  taskId: bigint
  buyer: `0x${string}`
  provider: `0x${string}`
  amount: bigint
  timestamp: bigint
  state: number // 0=Locked, 1=Released, 2=Disputed, 3=Refunded
  disputeDeadline: bigint
  disputer: `0x${string}`
}

export function useLockFunds() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const lockFunds = async (taskId: number, amount: string) => {
    const value = parseEther(amount)
    
    return writeContract({
      address: ESCROW_MANAGER_ADDRESS,
      abi: ESCROW_MANAGER_ABI,
      functionName: 'lockFunds',
      args: [BigInt(taskId)],
      value,
      chainId: flowEvmTestnet.id,
    })
  }

  return {
    lockFunds,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useReleaseFunds() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const releaseFunds = async (
    taskId: number,
    provider: `0x${string}`,
    validationScore: number
  ) => {
    return writeContract({
      address: ESCROW_MANAGER_ADDRESS,
      abi: ESCROW_MANAGER_ABI,
      functionName: 'releaseFunds',
      args: [BigInt(taskId), provider, validationScore],
      chainId: flowEvmTestnet.id,
    })
  }

  return {
    releaseFunds,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useRefundFunds() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const refundFunds = async (taskId: number) => {
    return writeContract({
      address: ESCROW_MANAGER_ADDRESS,
      abi: ESCROW_MANAGER_ABI,
      functionName: 'refundFunds',
      args: [BigInt(taskId)],
      chainId: flowEvmTestnet.id,
    })
  }

  return {
    refundFunds,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useInitiateDispute() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const initiateDispute = async (taskId: number) => {
    return writeContract({
      address: ESCROW_MANAGER_ADDRESS,
      abi: ESCROW_MANAGER_ABI,
      functionName: 'initiateDispute',
      args: [BigInt(taskId)],
      chainId: flowEvmTestnet.id,
    })
  }

  return {
    initiateDispute,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useResolveDispute() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const resolveDispute = async (taskId: number, providerWins: boolean) => {
    return writeContract({
      address: ESCROW_MANAGER_ADDRESS,
      abi: ESCROW_MANAGER_ABI,
      functionName: 'resolveDispute',
      args: [BigInt(taskId), providerWins],
      chainId: flowEvmTestnet.id,
    })
  }

  return {
    resolveDispute,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useGetEscrow(taskId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    functionName: 'getEscrow',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  return {
    escrow: data as Escrow | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetBuyerEscrows(buyer: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    functionName: 'getBuyerEscrows',
    args: buyer ? [buyer] : undefined,
    query: {
      enabled: !!buyer,
    },
  })

  return {
    taskIds: data as bigint[] | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetProviderEscrows(provider: `0x${string}` | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    functionName: 'getProviderEscrows',
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

export function useCanDispute(taskId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    functionName: 'canDispute',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  return {
    canDispute: data as boolean | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetTotalFeesCollected() {
  const { data, error, isLoading, refetch } = useReadContract({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    functionName: 'getTotalFeesCollected',
  })

  return {
    totalFees: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  }
}
