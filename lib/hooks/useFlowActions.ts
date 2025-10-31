'use client'

import { useCallback, useState } from 'react'
import { configureFcl, sendFlowTransaction } from '../flow-fcl'

export function useFlowActions() {
	const [isPending, setIsPending] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [txId, setTxId] = useState<string | null>(null)

	const autoReveal = useCallback(async (signalId: number, contractAddress: string) => {
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
			const res = await sendFlowTransaction(code, [(arg:any,t:any)=>arg(String(signalId), t.UInt64)])
			setTxId((res as any)?.transactionId || null)
			return res
		} catch (e:any) {
			setError(e)
			throw e
		} finally {
			setIsPending(false)
		}
	}, [])

	return { autoReveal, isPending, error, txId }
}
