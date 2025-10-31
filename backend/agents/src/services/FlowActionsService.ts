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

	/**
	 * Schedule an auto-reveal transaction using Flow Transaction Scheduler
	 * @param signalId Signal ID to auto-reveal
	 * @param delaySeconds Seconds to wait before executing (typically reveal deadline)
	 */
	async scheduleAutoReveal(signalId: number, delaySeconds: number) {
		if (!this.enabled) return { ok: false, error: "FLOW not configured" };
		const tx = `import FlowTransactionScheduler from 0x8c20400102010101
			import AutoRevealHandler from ${this.address}
			
			transaction(signalId: UInt64, delaySeconds: UInt64) {
				prepare(signer: AuthAccount) {
					let scheduler = signer.borrow<&FlowTransactionScheduler.Scheduler>(from: FlowTransactionScheduler.SchedulerStoragePath)
						?? panic("Scheduler not found")
					
					let handlerRef = signer.borrow<&AutoRevealHandler.Handler>(from: /storage/AutoRevealHandler)
						?? panic("AutoRevealHandler not found")
					
					let data = AutoRevealHandler.AutoRevealData(signalId: signalId)
					
					scheduler.scheduleTransaction(
						handler: handlerRef,
						delay: delaySeconds,
						data: data
					)
				}
			}`;
		return this.sendTx(tx, (ix: any) => {
			ix.args([
				{ value: String(signalId), xform: (v:any)=>({type:"UInt64", value: v}) },
				{ value: String(delaySeconds), xform: (v:any)=>({type:"UInt64", value: v}) }
			]);
		});
	}

	/**
	 * Schedule an auto-verification transaction using Flow Transaction Scheduler
	 * @param signalId Signal ID to verify
	 * @param score Validation score
	 * @param delaySeconds Seconds to wait before executing
	 */
	async scheduleAutoVerification(signalId: number, score: number, delaySeconds: number) {
		if (!this.enabled) return { ok: false, error: "FLOW not configured" };
		const tx = `import FlowTransactionScheduler from 0x8c20400102010101
			import AutoVerificationHandler from ${this.address}
			
			transaction(signalId: UInt64, score: UInt8, delaySeconds: UInt64) {
				prepare(signer: AuthAccount) {
					let scheduler = signer.borrow<&FlowTransactionScheduler.Scheduler>(from: FlowTransactionScheduler.SchedulerStoragePath)
						?? panic("Scheduler not found")
					
					let handlerRef = signer.borrow<&AutoVerificationHandler.Handler>(from: /storage/AutoVerificationHandler)
						?? panic("AutoVerificationHandler not found")
					
					let data = AutoVerificationHandler.VerificationData(signalId: signalId, score: score)
					
					scheduler.scheduleTransaction(
						handler: handlerRef,
						delay: delaySeconds,
						data: data
					)
				}
			}`;
		return this.sendTx(tx, (ix: any) => {
			ix.args([
				{ value: String(signalId), xform: (v:any)=>({type:"UInt64", value: v}) },
				{ value: String(score), xform: (v:any)=>({type:"UInt8", value: v}) },
				{ value: String(delaySeconds), xform: (v:any)=>({type:"UInt64", value: v}) }
			]);
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

