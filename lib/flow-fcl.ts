'use client'

import * as fcl from '@onflow/fcl'

let configured = false

export function configureFcl() {
	if (configured) return
	fcl.config()
		.put('accessNode.api', 'https://rest-testnet.onflow.org')
		.put('discovery.wallet', 'https://fcl-discovery.onflow.org/testnet/authn')
		.put('app.detail.title', 'Skal')
		.put('app.detail.icon', 'https://skal.sh/favicon.ico')
	configured = true
}

export async function sendFlowTransaction(code: string, args: any[] = []) {
	configureFcl()
	const txId = await fcl.mutate({
		cadence: code,
		args: (arg: any, t: any) => args,
		limit: 9999,
	})
	return fcl.tx(txId).onceSealed()
}

export { fcl }
