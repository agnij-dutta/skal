import { JsonRpcProvider, Wallet } from 'ethers'

export abstract class Agent {
  protected provider: JsonRpcProvider
  protected wallet: Wallet

  constructor(rpcUrl: string, privateKey: string) {
    this.provider = new JsonRpcProvider(rpcUrl)
    this.wallet = new Wallet(privateKey, this.provider)
  }
}



