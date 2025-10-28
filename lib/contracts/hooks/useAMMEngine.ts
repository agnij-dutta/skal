'use client'

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useMemo } from 'react'
import { parseEther } from 'viem'
import { AMM_ENGINE_ABI } from '../abis/ammEngine'
import { CONTRACT_ADDRESSES_FLOW as CONTRACT_ADDRESSES } from '../../flow-config'

const AMM_ENGINE_ADDRESS = CONTRACT_ADDRESSES.AMM_ENGINE as `0x${string}`

export interface Market {
  marketId: bigint
  tokenA: `0x${string}`
  tokenB: `0x${string}`
  reserveA: bigint
  reserveB: bigint
  totalSupply: bigint
  active: boolean
  createdAt: bigint
}

export function useCreateMarket() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const createMarket = async (
    marketId: number,
    tokenA: `0x${string}`,
    tokenB: `0x${string}`
  ) => {
    return writeContract({
      address: AMM_ENGINE_ADDRESS,
      abi: AMM_ENGINE_ABI,
      functionName: 'createMarket',
      args: [BigInt(marketId), tokenA, tokenB],
    })
  }

  return {
    createMarket,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useAddLiquidity() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const addLiquidity = async (
    marketId: number,
    amountA: string,
    amountB: string
  ) => {
    const amountAWei = parseEther(amountA)
    const amountBWei = parseEther(amountB) // Both amounts should be in FLOW (same token)
    
    return writeContract({
      address: AMM_ENGINE_ADDRESS,
      abi: AMM_ENGINE_ABI,
      functionName: 'addLiquidity',
      args: [BigInt(marketId), amountAWei, amountBWei],
      value: amountAWei + amountBWei, // Native-only pool: send both amounts as value
    })
  }

  return {
    addLiquidity,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useRemoveLiquidity() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const removeLiquidity = async (marketId: number, lpTokens: string) => {
    const lpTokensWei = parseEther(lpTokens)
    
    return writeContract({
      address: AMM_ENGINE_ADDRESS,
      abi: AMM_ENGINE_ABI,
      functionName: 'removeLiquidity',
      args: [BigInt(marketId), lpTokensWei],
    })
  }

  return {
    removeLiquidity,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useBuySignal() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const buySignal = async (
    marketId: number,
    amountIn: string,
    minAmountOut: string
  ) => {
    const amountInWei = parseEther(amountIn)
    const minAmountOutWei = parseEther(minAmountOut)
    
    return writeContract({
      address: AMM_ENGINE_ADDRESS,
      abi: AMM_ENGINE_ABI,
      functionName: 'buySignal',
      args: [BigInt(marketId), amountInWei, minAmountOutWei],
      value: amountInWei,
    })
  }

  return {
    buySignal,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useSellSignal() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const sellSignal = async (
    marketId: number,
    amountIn: string,
    minAmountOut: string
  ) => {
    const amountInWei = parseEther(amountIn)
    const minAmountOutWei = parseEther(minAmountOut)
    
    return writeContract({
      address: AMM_ENGINE_ADDRESS,
      abi: AMM_ENGINE_ABI,
      functionName: 'sellSignal',
      args: [BigInt(marketId), amountInWei, minAmountOutWei],
    })
  }

  return {
    sellSignal,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    isLoading: isPending || isConfirming,
  }
}

export function useGetMarket(marketId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    functionName: 'getMarket',
    args: marketId !== undefined ? [BigInt(marketId)] : undefined,
    query: {
      enabled: marketId !== undefined,
    },
  })

  return {
    market: data as Market | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetUserLPTokens(user: `0x${string}` | undefined, marketId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    functionName: 'getUserLPTokens',
    args: user && marketId !== undefined ? [user, BigInt(marketId)] : undefined,
    query: {
      enabled: !!user && marketId !== undefined,
    },
  })

  return {
    lpTokens: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetMarketFees(marketId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    functionName: 'getMarketFees',
    args: marketId !== undefined ? [BigInt(marketId)] : undefined,
    query: {
      enabled: marketId !== undefined,
    },
  })

  return {
    fees: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  }
}

export function useGetAmountOut() {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    functionName: 'getAmountOut',
  })

  const getAmountOut = async (
    amountIn: string,
    reserveIn: string,
    reserveOut: string
  ) => {
    const amountInWei = parseEther(amountIn)
    const reserveInWei = parseEther(reserveIn)
    const reserveOutWei = parseEther(reserveOut)
    
    // This would need to be called via a contract read
    // For now, return a placeholder
    return BigInt(0)
  }

  return {
    getAmountOut,
    error,
    isLoading,
    refetch,
  }
}

export function useGetLPTokenBalance(user: `0x${string}` | undefined, marketId: number | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    functionName: 'getUserLPTokens',
    args: user && marketId !== undefined ? [user, BigInt(marketId)] : undefined,
    query: {
      enabled: !!user && marketId !== undefined,
    },
  })

  return {
    data: data ? data.toString() : '0',
    error,
    isLoading,
    refetch
  }
}

export function useGetMarketLiquidity(marketId: number | undefined) {
  const { data: market, error, isLoading, refetch } = useReadContract({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    functionName: 'getMarket',
    args: marketId !== undefined ? [BigInt(marketId)] : undefined,
    query: {
      enabled: marketId !== undefined,
    },
  })

  const liquidity = useMemo(() => {
    if (!market) return { totalLiquidity: '0', reserveA: '0', reserveB: '0' }
    
    return {
      totalLiquidity: (market.reserveA + market.reserveB).toString(),
      reserveA: market.reserveA.toString(),
      reserveB: market.reserveB.toString(),
    }
  }, [market])

  return {
    data: liquidity,
    market,
    error,
    isLoading,
    refetch
  }
}
