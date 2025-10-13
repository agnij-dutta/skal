'use client'

import { useWatchContractEvent } from 'wagmi'
import { COMMIT_REGISTRY_ABI } from './abis/commitRegistry'
import { ESCROW_MANAGER_ABI } from './abis/escrowManager'
import { AMM_ENGINE_ABI } from './abis/ammEngine'
import { REPUTATION_MANAGER_ABI } from './abis/reputationManager'
import { AGENT_REGISTRY_ABI } from './abis/agentRegistry'
import { CONTRACT_ADDRESSES } from '../somnia-config'

const COMMIT_REGISTRY_ADDRESS = CONTRACT_ADDRESSES.COMMIT_REGISTRY as `0x${string}`
const ESCROW_MANAGER_ADDRESS = CONTRACT_ADDRESSES.ESCROW_MANAGER as `0x${string}`
const AMM_ENGINE_ADDRESS = CONTRACT_ADDRESSES.AMM_ENGINE as `0x${string}`
const REPUTATION_MANAGER_ADDRESS = CONTRACT_ADDRESSES.REPUTATION_MANAGER as `0x${string}`
const AGENT_REGISTRY_ADDRESS = CONTRACT_ADDRESSES.AGENT_REGISTRY as `0x${string}`

// Event types
export interface TaskCommittedEvent {
  taskId: bigint
  commitHash: `0x${string}`
  provider: `0x${string}`
  marketId: bigint
  stake: bigint
  timestamp: bigint
}

export interface TaskRevealedEvent {
  taskId: bigint
  cid: string
  timestamp: bigint
}

export interface TaskValidatedEvent {
  taskId: bigint
  score: number
  verifier: `0x${string}`
  timestamp: bigint
}

export interface TaskSettledEvent {
  taskId: bigint
  provider: `0x${string}`
  payout: bigint
  timestamp: bigint
}

export interface TaskDisputedEvent {
  taskId: bigint
  disputer: `0x${string}`
  timestamp: bigint
}

export interface FundsLockedEvent {
  taskId: bigint
  buyer: `0x${string}`
  provider: `0x${string}`
  amount: bigint
  timestamp: bigint
}

export interface FundsReleasedEvent {
  taskId: bigint
  provider: `0x${string}`
  amount: bigint
  timestamp: bigint
}

export interface FundsRefundedEvent {
  taskId: bigint
  buyer: `0x${string}`
  amount: bigint
  timestamp: bigint
}

export interface DisputeInitiatedEvent {
  taskId: bigint
  disputer: `0x${string}`
  timestamp: bigint
}

export interface DisputeResolvedEvent {
  taskId: bigint
  providerWins: boolean
  timestamp: bigint
}

export interface MarketCreatedEvent {
  marketId: bigint
  tokenA: `0x${string}`
  tokenB: `0x${string}`
  timestamp: bigint
}

export interface LiquidityAddedEvent {
  marketId: bigint
  provider: `0x${string}`
  amountA: bigint
  amountB: bigint
  lpTokens: bigint
  timestamp: bigint
}

export interface LiquidityRemovedEvent {
  marketId: bigint
  provider: `0x${string}`
  amountA: bigint
  amountB: bigint
  lpTokens: bigint
  timestamp: bigint
}

export interface SignalBoughtEvent {
  marketId: bigint
  buyer: `0x${string}`
  amountIn: bigint
  amountOut: bigint
  timestamp: bigint
}

export interface SignalSoldEvent {
  marketId: bigint
  seller: `0x${string}`
  amountIn: bigint
  amountOut: bigint
  timestamp: bigint
}

export interface ReputationUpdatedEvent {
  user: `0x${string}`
  oldScore: bigint
  newScore: bigint
  timestamp: bigint
}

export interface StakeDepositedEvent {
  user: `0x${string}`
  amount: bigint
  timestamp: bigint
}

export interface StakeWithdrawnEvent {
  user: `0x${string}`
  amount: bigint
  timestamp: bigint
}

export interface StakeSlashedEvent {
  user: `0x${string}`
  amount: bigint
  reason: string
  timestamp: bigint
}

export interface AgentRegisteredEvent {
  agentAddress: `0x${string}`
  agentType: number
  name: string
  timestamp: bigint
}

export interface AgentUpdatedEvent {
  agentAddress: `0x${string}`
  name: string
  timestamp: bigint
}

export interface AgentDeactivatedEvent {
  agentAddress: `0x${string}`
  timestamp: bigint
}

export interface AgentReactivatedEvent {
  agentAddress: `0x${string}`
  timestamp: bigint
}

export interface StakeUpdatedEvent {
  agentAddress: `0x${string}`
  oldStake: bigint
  newStake: bigint
  timestamp: bigint
}

export interface MetadataUpdatedEvent {
  agentAddress: `0x${string}`
  key: string
  value: string
  timestamp: bigint
}

// Hook for watching CommitRegistry events
export function useWatchCommitRegistryEvents(
  onTaskCommitted?: (event: TaskCommittedEvent) => void,
  onTaskRevealed?: (event: TaskRevealedEvent) => void,
  onTaskValidated?: (event: TaskValidatedEvent) => void,
  onTaskSettled?: (event: TaskSettledEvent) => void,
  onTaskDisputed?: (event: TaskDisputedEvent) => void
) {
  useWatchContractEvent({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    eventName: 'TaskCommitted',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onTaskCommitted?.({
          taskId: log.args.taskId,
          commitHash: log.args.commitHash,
          provider: log.args.provider,
          marketId: log.args.marketId,
          stake: log.args.stake,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    eventName: 'TaskRevealed',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onTaskRevealed?.({
          taskId: log.args.taskId,
          cid: log.args.cid,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    eventName: 'TaskValidated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onTaskValidated?.({
          taskId: log.args.taskId,
          score: log.args.score,
          verifier: log.args.verifier,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    eventName: 'TaskSettled',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onTaskSettled?.({
          taskId: log.args.taskId,
          provider: log.args.provider,
          payout: log.args.payout,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: COMMIT_REGISTRY_ADDRESS,
    abi: COMMIT_REGISTRY_ABI,
    eventName: 'TaskDisputed',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onTaskDisputed?.({
          taskId: log.args.taskId,
          disputer: log.args.disputer,
          timestamp: log.args.timestamp,
        })
      })
    },
  })
}

// Hook for watching EscrowManager events
export function useWatchEscrowManagerEvents(
  onFundsLocked?: (event: FundsLockedEvent) => void,
  onFundsReleased?: (event: FundsReleasedEvent) => void,
  onFundsRefunded?: (event: FundsRefundedEvent) => void,
  onDisputeInitiated?: (event: DisputeInitiatedEvent) => void,
  onDisputeResolved?: (event: DisputeResolvedEvent) => void
) {
  useWatchContractEvent({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    eventName: 'FundsLocked',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onFundsLocked?.({
          taskId: log.args.taskId,
          buyer: log.args.buyer,
          provider: log.args.provider,
          amount: log.args.amount,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    eventName: 'FundsReleased',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onFundsReleased?.({
          taskId: log.args.taskId,
          provider: log.args.provider,
          amount: log.args.amount,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    eventName: 'FundsRefunded',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onFundsRefunded?.({
          taskId: log.args.taskId,
          buyer: log.args.buyer,
          amount: log.args.amount,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    eventName: 'DisputeInitiated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onDisputeInitiated?.({
          taskId: log.args.taskId,
          disputer: log.args.disputer,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: ESCROW_MANAGER_ADDRESS,
    abi: ESCROW_MANAGER_ABI,
    eventName: 'DisputeResolved',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onDisputeResolved?.({
          taskId: log.args.taskId,
          providerWins: log.args.providerWins,
          timestamp: log.args.timestamp,
        })
      })
    },
  })
}

// Hook for watching AMMEngine events
export function useWatchAMMEngineEvents(
  onMarketCreated?: (event: MarketCreatedEvent) => void,
  onLiquidityAdded?: (event: LiquidityAddedEvent) => void,
  onLiquidityRemoved?: (event: LiquidityRemovedEvent) => void,
  onSignalBought?: (event: SignalBoughtEvent) => void,
  onSignalSold?: (event: SignalSoldEvent) => void
) {
  useWatchContractEvent({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    eventName: 'MarketCreated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onMarketCreated?.({
          marketId: log.args.marketId,
          tokenA: log.args.tokenA,
          tokenB: log.args.tokenB,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    eventName: 'LiquidityAdded',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onLiquidityAdded?.({
          marketId: log.args.marketId,
          provider: log.args.provider,
          amountA: log.args.amountA,
          amountB: log.args.amountB,
          lpTokens: log.args.lpTokens,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    eventName: 'LiquidityRemoved',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onLiquidityRemoved?.({
          marketId: log.args.marketId,
          provider: log.args.provider,
          amountA: log.args.amountA,
          amountB: log.args.amountB,
          lpTokens: log.args.lpTokens,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    eventName: 'SignalBought',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onSignalBought?.({
          marketId: log.args.marketId,
          buyer: log.args.buyer,
          amountIn: log.args.amountIn,
          amountOut: log.args.amountOut,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AMM_ENGINE_ADDRESS,
    abi: AMM_ENGINE_ABI,
    eventName: 'SignalSold',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onSignalSold?.({
          marketId: log.args.marketId,
          seller: log.args.seller,
          amountIn: log.args.amountIn,
          amountOut: log.args.amountOut,
          timestamp: log.args.timestamp,
        })
      })
    },
  })
}

// Hook for watching ReputationManager events
export function useWatchReputationManagerEvents(
  onReputationUpdated?: (event: ReputationUpdatedEvent) => void,
  onStakeDeposited?: (event: StakeDepositedEvent) => void,
  onStakeWithdrawn?: (event: StakeWithdrawnEvent) => void,
  onStakeSlashed?: (event: StakeSlashedEvent) => void
) {
  useWatchContractEvent({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    eventName: 'ReputationUpdated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onReputationUpdated?.({
          user: log.args.user,
          oldScore: log.args.oldScore,
          newScore: log.args.newScore,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    eventName: 'StakeDeposited',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onStakeDeposited?.({
          user: log.args.user,
          amount: log.args.amount,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    eventName: 'StakeWithdrawn',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onStakeWithdrawn?.({
          user: log.args.user,
          amount: log.args.amount,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: REPUTATION_MANAGER_ADDRESS,
    abi: REPUTATION_MANAGER_ABI,
    eventName: 'StakeSlashed',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onStakeSlashed?.({
          user: log.args.user,
          amount: log.args.amount,
          reason: log.args.reason,
          timestamp: log.args.timestamp,
        })
      })
    },
  })
}

// Hook for watching AgentRegistry events
export function useWatchAgentRegistryEvents(
  onAgentRegistered?: (event: AgentRegisteredEvent) => void,
  onAgentUpdated?: (event: AgentUpdatedEvent) => void,
  onAgentDeactivated?: (event: AgentDeactivatedEvent) => void,
  onAgentReactivated?: (event: AgentReactivatedEvent) => void,
  onStakeUpdated?: (event: StakeUpdatedEvent) => void,
  onMetadataUpdated?: (event: MetadataUpdatedEvent) => void
) {
  useWatchContractEvent({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    eventName: 'AgentRegistered',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onAgentRegistered?.({
          agentAddress: log.args.agentAddress,
          agentType: log.args.agentType,
          name: log.args.name,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    eventName: 'AgentUpdated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onAgentUpdated?.({
          agentAddress: log.args.agentAddress,
          name: log.args.name,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    eventName: 'AgentDeactivated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onAgentDeactivated?.({
          agentAddress: log.args.agentAddress,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    eventName: 'AgentReactivated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onAgentReactivated?.({
          agentAddress: log.args.agentAddress,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    eventName: 'StakeUpdated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onStakeUpdated?.({
          agentAddress: log.args.agentAddress,
          oldStake: log.args.oldStake,
          newStake: log.args.newStake,
          timestamp: log.args.timestamp,
        })
      })
    },
  })

  useWatchContractEvent({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    eventName: 'MetadataUpdated',
    onLogs: (logs) => {
      logs.forEach((log) => {
        onMetadataUpdated?.({
          agentAddress: log.args.agentAddress,
          key: log.args.key,
          value: log.args.value,
          timestamp: log.args.timestamp,
        })
      })
    },
  })
}
