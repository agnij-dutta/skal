import * as fcl from "@onflow/fcl";
import { SHA3 } from "js-sha3";
import elliptic from "elliptic";

const ec = new elliptic.ec("p256");

export class FlowActionsService {
	private address: string;
	private privateKey: string;
	private enabled: boolean;

	constructor() {
		this.address = process.env.FLOW_ACCOUNT_ADDRESS || "";
		this.privateKey = process.env.FLOW_PRIVATE_KEY || "";
		this.enabled = !!this.address && !!this.privateKey;

		fcl.config()
			.put("accessNode.api", "https://rest-testnet.onflow.org")
			.put("sdk.transport", "HTTP/1.1");
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	private authorization() {
		const addr = this.address.replace(/^0x/, "");
		return async (account: any = {}) => {
			const keyId = 0;
			return {
				...account,
				addr,
				keyId,
				signingFunction: async (signable: any) => {
					const msg = Buffer.from(signable.message, "hex");
					const key = ec.keyFromPrivate(Buffer.from(this.privateKey, "hex"));
					const sig = key.sign(new SHA3(256).update(msg).digest());
					const n = 32;
					const r = sig.r.toArrayLike(Buffer, "be", n);
					const s = sig.s.toArrayLike(Buffer, "be", n);
					return {
						addr,
						keyId,
						signature: Buffer.concat([r, s]).toString("hex"),
					};
				},
			};
		};
	}

	async createMarket(marketId: number) {
		if (!this.enabled) return { ok: false, error: "FLOW not configured" };
		const tx = `import SignalMarketAMM from ${this.address}
			transaction(marketId: UInt64){
			  prepare(signer: AuthAccount){
			    SignalMarketAMM.createMarket(marketId: marketId)
			  }
			}`;
		return this.sendTx(tx, (ix: any) => {
			ix.args([{ value: String(marketId), xform: (v:any)=>({type:"UInt64", value: v}) }]);
		});
	}

	async addLiquidity(marketId: number, amountA: string, amountB: string) {
		if (!this.enabled) return { ok: false, error: "FLOW not configured" };
		const tx = `import SignalMarketAMM from ${this.address}
			transaction(marketId: UInt64, amountA: UFix64, amountB: UFix64){
			  prepare(signer: AuthAccount){
			    let _ = SignalMarketAMM.addLiquidity(marketId: marketId, amountA: amountA, amountB: amountB, provider: signer.address)
			  }
			}`;
		return this.sendTx(tx, (ix: any) => {
			ix.args([
				{ value: String(marketId), xform: (v:any)=>({type:"UInt64", value: v}) },
				{ value: amountA, xform: (v:any)=>({type:"UFix64", value: v}) },
				{ value: amountB, xform: (v:any)=>({type:"UFix64", value: v}) },
			]);
		});
	}

	async autoReveal(signalId: number) {
		if (!this.enabled) return { ok: false, error: "FLOW not configured" };
		const tx = `import SignalCommitRegistry from ${this.address}
			transaction(signalId: UInt64){
			  prepare(signer: AuthAccount){
			    SignalCommitRegistry.autoReveal(signalId: signalId)
			  }
			}`;
		return this.sendTx(tx, (ix: any) => {
			ix.args([{ value: String(signalId), xform: (v:any)=>({type:"UInt64", value: v}) }]);
		});
	}

	private async sendTx(code: string, buildArgs: (ix: any)=>void) {
		try {
			const proposer = this.authorization();
			const payer = this.authorization();
			const authorizations = [this.authorization()];
			const tx = await fcl.send([
				(fcl as any).transaction(code),
				(fcl as any).proposer(proposer),
				(fcl as any).payer(payer),
				(fcl as any).authorizations(authorizations),
				(fcl as any).limit(9999),
				(builder: any) => buildArgs(builder)
			]);
			const res = await fcl.tx(tx).onceSealed();
			return { ok: true, res };
		} catch (e:any) {
			return { ok: false, error: String(e?.message || e) };
		}
	}
}

