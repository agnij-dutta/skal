'use client'

import { useMemo } from 'react'
import { useGetMarketTasks, useGetTask } from './useCommitRegistry'
import { useGetReputation, useGetReputationScore } from './useReputationManager'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import { COMMIT_REGISTRY_ABI } from '../abis/commitRegistry'
import { CONTRACT_ADDRESSES } from '../../somnia-config'
import { shortenAddress } from '../../utils'
// import { useTaskDetails } from './useTaskDetails' // Commented out to avoid conflict

interface SignalData {
  id: string
  taskId: number
  marketId: number
  marketName: string
  provider: string
  providerReputation: number
  description: string
  price: string
  stake: string
  commitTime: string
  status: 'available' | 'locked' | 'revealed' | 'verified' | 'settled'
  verificationScore?: number
  category: string
  isLoading?: boolean
}

// Market metadata - this would ideally come from a config or database
const MARKET_METADATA = {
  1: {
    name: 'ETH Price Prediction',
    description: '1-hour Ethereum price predictions with 0.5% accuracy threshold',
    category: 'DeFi',
  },
  2: {
    name: 'DeFi Signals',
    description: 'Trading signals for DeFi protocols and yield farming opportunities',
    category: 'DeFi',
  },
  3: {
    name: 'NLP Embeddings',
    description: 'High-quality text embeddings for semantic search and similarity',
    category: 'NLP',
  },
} as const

// Hook to fetch individual task details
function useTaskDetails(taskId: number | undefined) {
  const { data: task, error, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.COMMIT_REGISTRY as `0x${string}`,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'getTask',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  return { task, error, isLoading }
}

export function useSignals(marketId?: number) {
  const { address } = useAccount()
  
  // Fetch tasks for all markets or specific market
  const market1Tasks = useGetMarketTasks(marketId === undefined || marketId === 1 ? 1 : undefined)
  const market2Tasks = useGetMarketTasks(marketId === undefined || marketId === 2 ? 2 : undefined)
  const market3Tasks = useGetMarketTasks(marketId === undefined || marketId === 3 ? 3 : undefined)

  // Get all task IDs
  const allTaskIds = useMemo(() => {
    const tasks: { taskId: bigint; marketId: number }[] = []
    
    if (market1Tasks.taskIds) {
      tasks.push(...market1Tasks.taskIds.map(id => ({ taskId: id, marketId: 1 })))
    }
    if (market2Tasks.taskIds) {
      tasks.push(...market2Tasks.taskIds.map(id => ({ taskId: id, marketId: 2 })))
    }
    if (market3Tasks.taskIds) {
      tasks.push(...market3Tasks.taskIds.map(id => ({ taskId: id, marketId: 3 })))
    }
    
    return tasks
  }, [market1Tasks.taskIds, market2Tasks.taskIds, market3Tasks.taskIds])

  // For now, we'll generate realistic data without fetching individual task details
  // to avoid hooks order issues. In production, you'd want to use multicall or batch reads
  const uniqueProviders = useMemo(() => {
    // Generate some realistic provider addresses based on task IDs
    const providers = new Set<string>()
    allTaskIds.forEach(({ taskId }) => {
      const taskIdNum = Number(taskId)
      if (taskIdNum <= 5) {
        // Use realistic addresses for first few tasks
        const providerAddress = `0x${taskIdNum.toString(16).padStart(8, '0')}...${taskIdNum.toString(16).slice(-4)}`
        providers.add(providerAddress)
      }
    })
    return Array.from(providers)
  }, [allTaskIds])

  // Note: Removed reputation fetching to avoid hooks order issues
  // In production, you'd use multicall or batch reads for this

  // Fetch individual task details for each task ID using useReadContracts for batch reading
  const taskDetails = useReadContracts({
    contracts: allTaskIds.map(({ taskId }) => ({
      address: CONTRACT_ADDRESSES.COMMIT_REGISTRY as `0x${string}`,
      abi: COMMIT_REGISTRY_ABI as any,
      functionName: 'getTask',
      args: [BigInt(taskId)],
    })),
    query: {
      enabled: allTaskIds.length > 0,
    },
  })

  // Transform task IDs into signal data with real contract data
  const signals = useMemo(() => {
    const isLoading = market1Tasks.isLoading || market2Tasks.isLoading || market3Tasks.isLoading || taskDetails.isLoading

    return allTaskIds.map(({ taskId, marketId }, index) => {
      const metadata = MARKET_METADATA[marketId as keyof typeof MARKET_METADATA]
      const taskIdNum = Number(taskId)
      const taskDetail = taskDetails.data?.[index]
      
      if (isLoading) {
        return {
          id: `task-${taskId}`,
          taskId: taskIdNum,
          marketId,
          marketName: metadata.name,
          provider: '0x...',
          providerReputation: 0,
          description: 'Loading...',
          price: '0 STT',
          stake: '0 STT',
          commitTime: 'Loading...',
          status: 'available' as const,
          category: metadata.category,
          isLoading: true,
        }
      }

      // Use real contract data if available
      let providerAddress = '0x...'
      let stake = '0 STT'
      let timestamp = 0
      let state = 0
      let validationScore = 0

      if (taskDetail?.result) {
        const task = taskDetail.result as any
        providerAddress = task.provider || '0x...'
        stake = task.stake ? formatEther(task.stake) + ' STT' : '0 STT'
        timestamp = Number(task.timestamp || 0)
        state = Number(task.state || 0)
        validationScore = Number(task.validationScore || 0)
      }

      // Calculate time ago from timestamp
      const now = Math.floor(Date.now() / 1000)
      const timeAgo = timestamp > 0 ? Math.floor((now - timestamp) / 60) : taskIdNum % 60
      
      // Map task state to signal status
      const getStatusFromTaskState = (state: number) => {
        switch (state) {
          case 0: return 'available' // Committed
          case 1: return 'available' // Revealed
          case 2: return 'verified'  // Validated
          case 3: return 'settled'   // Settled
          case 4: return 'available' // Disputed
          case 5: return 'available' // Cancelled
          default: return 'available'
        }
      }

      // Calculate reputation based on validation score and task ID
      const baseReputation = 500
      const validationBonus = validationScore * 50
      const providerReputation = Math.min(1000, baseReputation + validationBonus + (taskIdNum % 200))

      // Calculate price based on stake and market
      const basePrice = 0.05
      const marketMultiplier = marketId === 1 ? 1.2 : marketId === 2 ? 1.0 : 0.8
      const price = (basePrice * marketMultiplier + (taskIdNum % 10) * 0.01).toFixed(3)

      return {
        id: `task-${taskId}`,
        taskId: taskIdNum,
        marketId,
        marketName: metadata.name,
        provider: shortenAddress(providerAddress),
        providerReputation,
        description: `AI output for ${metadata.name}`,
        price: `${price} STT`,
        stake,
        commitTime: `${timeAgo} minutes ago`,
        status: getStatusFromTaskState(state),
        category: metadata.category,
        isLoading: false,
      }
    })
  }, [allTaskIds, market1Tasks.isLoading, market2Tasks.isLoading, market3Tasks.isLoading, taskDetails.data, taskDetails.isLoading])

  return {
    signals,
    isLoading: market1Tasks.isLoading || market2Tasks.isLoading || market3Tasks.isLoading || taskDetails.isLoading,
    error: market1Tasks.error || market2Tasks.error || market3Tasks.error || taskDetails.error,
  }
}

export function useUserSignals() {
  const { address } = useAccount()
  const { signals, isLoading, error } = useSignals()

  // This hook will be used in combination with UserSignalsContext
  // The actual purchased signals come from the context, not from filtering all signals
  const userSignals = useMemo(() => {
    if (!address) return []
    
    // Return empty array - actual purchased signals come from UserSignalsContext
    // This hook is kept for consistency with the interface
    return []
  }, [address])

  return {
    signals: userSignals,
    isLoading,
    error,
  }
}

export function useAvailableSignals() {
  const { signals, isLoading, error } = useSignals()

  // Filter only available signals
  const availableSignals = useMemo(() => {
    return signals.filter(signal => signal.status === 'available')
  }, [signals])

  return {
    signals: availableSignals,
    isLoading,
    error,
  }
}

export function useVerifiedSignals() {
  const { signals, isLoading, error } = useSignals()

  // Filter only verified signals
  const verifiedSignals = useMemo(() => {
    return signals.filter(signal => signal.status && signal.status.toLowerCase() === 'verified')
  }, [signals])

  return {
    signals: verifiedSignals,
    isLoading,
    error,
  }
}
