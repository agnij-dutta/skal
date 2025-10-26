import { useReadContract, useReadContracts, useWatchContractEvent } from 'wagmi'
import { CONTRACT_ADDRESSES } from '../../somnia-config'
import { useState, useEffect } from 'react'

// Oracle Registry ABI
const ORACLE_REGISTRY_ABI = [
  {
    inputs: [{ name: 'oracleAddress', type: 'address' }],
    name: 'getOracle',
    outputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'bool' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveOracles',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveOracleCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'oracleAddress', type: 'address' }],
    name: 'isActiveOracle',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Verification Aggregator ABI
const VERIFICATION_AGGREGATOR_ABI = [
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'getSubmissionCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'hasConsensus',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'getTimeRemaining',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'taskFinalized',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'verifier', type: 'address' },
      { indexed: false, name: 'score', type: 'uint8' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'VerificationSubmitted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: false, name: 'finalScore', type: 'uint8' },
      { indexed: false, name: 'submissionCount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'ConsensusReached',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: false, name: 'finalScore', type: 'uint8' },
      { indexed: false, name: 'verifiers', type: 'address[]' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'TaskFinalized',
    type: 'event',
  },
] as const

/**
 * Get active oracle count
 */
export function useOracleCount() {
  const result = useReadContract({
    address: CONTRACT_ADDRESSES.ORACLE_REGISTRY as `0x${string}`,
    abi: ORACLE_REGISTRY_ABI,
    functionName: 'getActiveOracleCount',
  })

  return {
    count: result.data ? Number(result.data) : 0,
    ...result,
  }
}

/**
 * Get active oracles
 */
export function useActiveOracles() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ORACLE_REGISTRY as `0x${string}`,
    abi: ORACLE_REGISTRY_ABI,
    functionName: 'getActiveOracles',
  })
}

/**
 * Get verification progress for a task
 */
export function useVerificationProgress(taskId: number | undefined) {
  const submissionCount = useReadContract({
    address: CONTRACT_ADDRESSES.VERIFICATION_AGGREGATOR as `0x${string}`,
    abi: VERIFICATION_AGGREGATOR_ABI,
    functionName: 'getSubmissionCount',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  const hasConsensus = useReadContract({
    address: CONTRACT_ADDRESSES.VERIFICATION_AGGREGATOR as `0x${string}`,
    abi: VERIFICATION_AGGREGATOR_ABI,
    functionName: 'hasConsensus',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  const timeRemaining = useReadContract({
    address: CONTRACT_ADDRESSES.VERIFICATION_AGGREGATOR as `0x${string}`,
    abi: VERIFICATION_AGGREGATOR_ABI,
    functionName: 'getTimeRemaining',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  const isFinalized = useReadContract({
    address: CONTRACT_ADDRESSES.VERIFICATION_AGGREGATOR as `0x${string}`,
    abi: VERIFICATION_AGGREGATOR_ABI,
    functionName: 'taskFinalized',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  return {
    submissionCount: submissionCount.data ? Number(submissionCount.data) : 0,
    hasConsensus: hasConsensus.data || false,
    timeRemaining: timeRemaining.data ? Number(timeRemaining.data) : 0,
    isFinalized: isFinalized.data || false,
    isLoading:
      submissionCount.isLoading ||
      hasConsensus.isLoading ||
      timeRemaining.isLoading ||
      isFinalized.isLoading,
    refetch: () => {
      submissionCount.refetch()
      hasConsensus.refetch()
      timeRemaining.refetch()
      isFinalized.refetch()
    },
  }
}

/**
 * Watch oracle events
 */
export function useWatchOracleEvents(callbacks: {
  onVerificationSubmitted?: (event: {
    taskId: bigint
    verifier: string
    score: number
    timestamp: bigint
  }) => void
  onConsensusReached?: (event: {
    taskId: bigint
    finalScore: number
    submissionCount: bigint
    timestamp: bigint
  }) => void
  onTaskFinalized?: (event: {
    taskId: bigint
    finalScore: number
    verifiers: string[]
    timestamp: bigint
  }) => void
}) {
  // Watch VerificationSubmitted
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.VERIFICATION_AGGREGATOR as `0x${string}`,
    abi: VERIFICATION_AGGREGATOR_ABI,
    eventName: 'VerificationSubmitted',
    onLogs: (logs) => {
      logs.forEach((log) => {
        if (callbacks.onVerificationSubmitted && 'args' in log && log.args) {
          callbacks.onVerificationSubmitted({
            taskId: log.args.taskId as bigint,
            verifier: log.args.verifier as string,
            score: Number(log.args.score),
            timestamp: log.args.timestamp as bigint,
          })
        }
      })
    },
  })

  // Watch ConsensusReached
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.VERIFICATION_AGGREGATOR as `0x${string}`,
    abi: VERIFICATION_AGGREGATOR_ABI,
    eventName: 'ConsensusReached',
    onLogs: (logs) => {
      logs.forEach((log) => {
        if (callbacks.onConsensusReached && 'args' in log && log.args) {
          callbacks.onConsensusReached({
            taskId: log.args.taskId as bigint,
            finalScore: Number(log.args.finalScore),
            submissionCount: log.args.submissionCount as bigint,
            timestamp: log.args.timestamp as bigint,
          })
        }
      })
    },
  })

  // Watch TaskFinalized
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.VERIFICATION_AGGREGATOR as `0x${string}`,
    abi: VERIFICATION_AGGREGATOR_ABI,
    eventName: 'TaskFinalized',
    onLogs: (logs) => {
      logs.forEach((log) => {
        if (callbacks.onTaskFinalized && 'args' in log && log.args) {
          callbacks.onTaskFinalized({
            taskId: log.args.taskId as bigint,
            finalScore: Number(log.args.finalScore),
            verifiers: log.args.verifiers as string[],
            timestamp: log.args.timestamp as bigint,
          })
        }
      })
    },
  })
}

/**
 * Custom hook for comprehensive oracle status
 */
export function useOracleStatus(taskId: number | undefined) {
  const [status, setStatus] = useState<{
    stage: 'idle' | 'collecting' | 'consensus' | 'finalized'
    progress: number
    message: string
  }>({
    stage: 'idle',
    progress: 0,
    message: 'Waiting for oracle verification...',
  })

  const progress = useVerificationProgress(taskId)
  const oracleCount = useOracleCount()

  useEffect(() => {
    if (!taskId) {
      setStatus({
        stage: 'idle',
        progress: 0,
        message: 'Waiting for oracle verification...',
      })
      return
    }

    if (progress.isFinalized) {
      setStatus({
        stage: 'finalized',
        progress: 100,
        message: 'Verification finalized!',
      })
    } else if (progress.hasConsensus) {
      setStatus({
        stage: 'consensus',
        progress: 90,
        message: 'Consensus reached, finalizing...',
      })
    } else if (progress.submissionCount > 0) {
      const progressPercent = (progress.submissionCount / Math.max(oracleCount.count, 3)) * 80
      setStatus({
        stage: 'collecting',
        progress: progressPercent,
        message: `${progress.submissionCount} of ${Math.max(oracleCount.count, 3)} oracles submitted`,
      })
    } else {
      setStatus({
        stage: 'idle',
        progress: 0,
        message: 'Waiting for oracle submissions...',
      })
    }
  }, [
    taskId,
    progress.submissionCount,
    progress.hasConsensus,
    progress.isFinalized,
    oracleCount.count,
  ])

  return {
    ...status,
    ...progress,
    oracleCount: oracleCount.count,
  }
}





