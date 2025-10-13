'use client'

import { useMemo } from 'react'
import { useReadContract } from 'wagmi'
import { COMMIT_REGISTRY_ABI } from '../abis/commitRegistry'
import { CONTRACT_ADDRESSES } from '../../somnia-config'
import { formatEther } from 'viem'

interface TaskDetails {
  taskId: number
  commitHash: string
  provider: string
  marketId: number
  stake: string
  timestamp: number
  state: number
  cid: string
  validationScore: number
  verifier: string
  revealDeadline: number
  validationDeadline: number
  isLoading: boolean
  error?: Error
}

export function useTaskDetails(taskId: number | undefined) {
  const { data: task, error, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.COMMIT_REGISTRY as `0x${string}`,
    abi: COMMIT_REGISTRY_ABI,
    functionName: 'getTask',
    args: taskId !== undefined ? [BigInt(taskId)] : undefined,
    query: {
      enabled: taskId !== undefined,
    },
  })

  const taskDetails = useMemo((): TaskDetails | undefined => {
    if (!task || isLoading) {
      return {
        taskId: taskId || 0,
        commitHash: '',
        provider: '',
        marketId: 0,
        stake: '0',
        timestamp: 0,
        state: 0,
        cid: '',
        validationScore: 0,
        verifier: '',
        revealDeadline: 0,
        validationDeadline: 0,
        isLoading: true,
        error: error || undefined,
      }
    }

    // Task structure from contract:
    // struct Task {
    //   bytes32 commitHash;
    //   address provider;
    //   uint256 marketId;
    //   uint256 stake;
    //   uint256 timestamp;
    //   TaskState state;
    //   string cid;
    //   uint8 validationScore;
    //   address verifier;
    //   uint256 revealDeadline;
    //   uint256 validationDeadline;
    // }

    const [
      commitHash,
      provider,
      marketId,
      stake,
      timestamp,
      state,
      cid,
      validationScore,
      verifier,
      revealDeadline,
      validationDeadline
    ] = task as [string, string, bigint, bigint, bigint, number, string, number, string, bigint, bigint]

    return {
      taskId: taskId || 0,
      commitHash,
      provider,
      marketId: Number(marketId),
      stake: formatEther(stake),
      timestamp: Number(timestamp),
      state,
      cid,
      validationScore,
      verifier,
      revealDeadline: Number(revealDeadline),
      validationDeadline: Number(validationDeadline),
      isLoading: false,
      error: error || undefined,
    }
  }, [task, isLoading, error, taskId])

  return taskDetails
}

export function useMultipleTaskDetails(taskIds: number[]) {
  // This would ideally batch multiple task reads, but for now we'll return individual hooks
  // In a real implementation, you'd want to use multicall or similar batching
  return taskIds.map(taskId => useTaskDetails(taskId))
}
