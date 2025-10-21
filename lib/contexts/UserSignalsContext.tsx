'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAccount } from 'wagmi'

interface PurchasedSignal {
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
  transactionHash?: string
  purchaseTime: string
  encryptionKey?: string
  nonce?: string
  cid?: string
  isLoading?: boolean
}

interface UserSignalsContextType {
  purchasedSignals: PurchasedSignal[]
  addPurchasedSignal: (signal: Omit<PurchasedSignal, 'purchaseTime'>) => void
  removePurchasedSignal: (signalId: string) => void
  updateSignalStatus: (signalId: string, status: PurchasedSignal['status']) => void
  updateSignalStatusByTaskId: (taskId: number, status: PurchasedSignal['status']) => void
  getSignalById: (signalId: string) => PurchasedSignal | undefined
}

const UserSignalsContext = createContext<UserSignalsContextType | undefined>(undefined)

export function UserSignalsProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  const [purchasedSignals, setPurchasedSignals] = useState<PurchasedSignal[]>([])

  // Load signals from localStorage on mount and when address changes
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`userSignals_${address}`)
      if (stored) {
        try {
          setPurchasedSignals(JSON.parse(stored))
        } catch (error) {
          console.error('Failed to load user signals:', error)
        }
      }
    } else {
      setPurchasedSignals([])
    }
  }, [address])

  // Save signals to localStorage whenever they change
  useEffect(() => {
    if (address && purchasedSignals.length > 0) {
      localStorage.setItem(`userSignals_${address}`, JSON.stringify(purchasedSignals))
    }
  }, [purchasedSignals, address])

  const addPurchasedSignal = (signal: Omit<PurchasedSignal, 'purchaseTime'>) => {
    const newSignal: PurchasedSignal = {
      ...signal,
      purchaseTime: new Date().toISOString(),
      status: 'locked', // Initially locked when purchased
    }
    
    setPurchasedSignals(prev => {
      // Check if signal already exists
      const exists = prev.some(s => s.id === newSignal.id)
      if (exists) {
        return prev
      }
      return [...prev, newSignal]
    })
  }

  const removePurchasedSignal = (signalId: string) => {
    setPurchasedSignals(prev => prev.filter(s => s.id !== signalId))
  }

  const updateSignalStatus = (signalId: string, status: PurchasedSignal['status']) => {
    setPurchasedSignals(prev => 
      prev.map(s => s.id === signalId ? { ...s, status } : s)
    )
  }

  const updateSignalStatusByTaskId = (taskId: number, status: PurchasedSignal['status']) => {
    setPurchasedSignals(prev => 
      prev.map(s => s.taskId === taskId ? { ...s, status } : s)
    )
  }

  const getSignalById = (signalId: string) => {
    return purchasedSignals.find(s => s.id === signalId)
  }

  return (
    <UserSignalsContext.Provider value={{
      purchasedSignals,
      addPurchasedSignal,
      removePurchasedSignal,
      updateSignalStatus,
      updateSignalStatusByTaskId,
      getSignalById,
    }}>
      {children}
    </UserSignalsContext.Provider>
  )
}

export function useUserSignalsContext() {
  const context = useContext(UserSignalsContext)
  if (context === undefined) {
    throw new Error('useUserSignalsContext must be used within a UserSignalsProvider')
  }
  return context
}