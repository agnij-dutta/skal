import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { Wallet, JsonRpcProvider } from 'ethers'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const ROOT = process.cwd()
const ENV_PATH = join(ROOT, '.env.local')
const KEYSTORE_DIR = join(ROOT, 'keystores')

function genWallet(label: string) {
  const w = Wallet.createRandom()
  return { label, address: w.address, privateKey: w.privateKey, wallet: w }
}

function upsertEnv(vars: Record<string, string>, force = false) {
  let envContent = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
  for (const [k, v] of Object.entries(vars)) {
    const line = `${k}=${v}`
    const regex = new RegExp(`^${k}=.*$`, 'm')
    if (regex.test(envContent)) {
      if (force) envContent = envContent.replace(regex, line)
    } else {
      envContent += (envContent.endsWith('\n') ? '' : '\n') + line + '\n'
    }
  }
  writeFileSync(ENV_PATH, envContent, { encoding: 'utf8' })
}

async function main() {
  const force = process.argv.includes('--force')
  if (!existsSync(KEYSTORE_DIR)) mkdirSync(KEYSTORE_DIR, { recursive: true })

  const roles = [
    { env: 'PROVIDER_PK', name: 'provider' },
    { env: 'BUYER_PK', name: 'buyer' },
    { env: 'VERIFIER_PK', name: 'verifier' },
    { env: 'LP_PK', name: 'lp' }
  ]

  const generated: Record<string, string> = {}

  for (const r of roles) {
    const w = genWallet(r.name)
    generated[r.env] = w.privateKey
    const keystorePath = join(KEYSTORE_DIR, `${r.name}-${w.address}.txt`)
    writeFileSync(keystorePath, `address=${w.address}\nprivateKey=${w.privateKey}\n`, { encoding: 'utf8' })
    console.log(`[wallet] ${r.name}: ${w.address} -> ${keystorePath}`)
  }

  upsertEnv(generated, force)
  
  // Set default faucet URL if not present
  const faucetUrl = process.env.SOMNIA_FAUCET_URL || 'https://testnet.somnia.network/'
  if (!process.env.SOMNIA_FAUCET_URL) {
    upsertEnv({ SOMNIA_FAUCET_URL: faucetUrl }, false)
    console.log(`\n💧 Set SOMNIA_FAUCET_URL=${faucetUrl}`)
  }
  
  // Enable auto-funding by default
  if (!process.env.AUTO_FUND) {
    upsertEnv({ AUTO_FUND: 'true' }, false)
    console.log(`💧 Set AUTO_FUND=true (wallets will auto-fund on startup)`)
  }
  
  console.log(`\n✅ Wrote keys to ${ENV_PATH}\n🔐 Keystores saved under ${KEYSTORE_DIR}`)
  console.log(`\n💡 Tip: Set SOMNIA_FAUCET_URL in .env.local if you have a specific faucet endpoint`)
  console.log(`💡 Tip: Set FUNDING_PK in .env.local for fallback funding from a funded wallet`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


