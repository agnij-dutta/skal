'use client'

import { useCallback, useState } from 'react'
import * as fcl from '@onflow/fcl'
import { configureFcl } from '../flow-fcl'

export function useFlowActions() {
	const [isPending, setIsPending] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [txId, setTxId] = useState<string | null>(null)

	const autoReveal = useCallback(async (signalId: number, contractAddress: string, waitForSeal: boolean = false) => {
		setIsPending(true)
		setError(null)
		setTxId(null)
		configureFcl()
		const code = `import SignalCommitRegistry from ${contractAddress}
		  transaction(signalId: UInt64) {
		    prepare(signer: AuthAccount) {}
		    execute { SignalCommitRegistry.autoReveal(signalId: signalId) }
		  }`
		try {
			// Submit transaction (non-blocking)
			const txId = await fcl.mutate({
				cadence: code,
				args: (arg: any, t: any) => [arg(String(signalId), t.UInt64)],
				limit: 9999,
			})
			
			setTxId(txId)
			
			// Only wait for seal if explicitly requested (prevents UI blocking)
			if (waitForSeal) {
				const res = await fcl.tx(txId).onceSealed()
				setIsPending(false)
				return res
			} else {
				// Fire-and-forget: don't wait for seal to avoid blocking UI
				// Transaction will complete in background
				fcl.tx(txId).onceSealed().catch((e: any) => {
					setError(e)
					console.error('Flow transaction seal error (non-blocking):', e)
				})
				setIsPending(false)
				return { transactionId: txId, sealed: false }
			}
		} catch (e:any) {
			setError(e)
			setIsPending(false)
			throw e
		}
	}, [])

	return { autoReveal, isPending, error, txId }
}
