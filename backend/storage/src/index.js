import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import multer from 'multer'
import pinataSDK from '@pinata/sdk'
import rateLimit from 'express-rate-limit'
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { sha256 } from '@noble/hashes/sha256'
import { z } from 'zod'

// Load env from local first, then fall back to repo root .env.local if missing
dotenv.config({ path: '.env.local' })
if (!process.env.PINATA_JWT) {
  const rootEnv = path.resolve(__dirname, '../../.env.local')
  dotenv.config({ path: rootEnv })
}

const app = express()

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://useskal.vercel.app', // Update with actual frontend URL
  ],
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)
app.use(express.json({ limit: '10mb' }))

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
})

const pinata = new pinataSDK({
  pinataJWTKey: process.env.PINATA_JWT,
})

if (!process.env.PINATA_JWT) {
  console.warn('[shadow-storage] PINATA_JWT not found in env. Set it in backend/storage/.env.local or project root .env.local')
}

// Validation schemas
const encryptUploadSchema = z.object({
  data: z.string().optional(),
  policyId: z.string().optional(),
  provider: z.string().optional(),
})

const ipfsRetrieveSchema = z.object({
  cid: z.string().min(1),
  key: z.string().optional(),
  nonce: z.string().optional(),
})

function encryptBuffer(plaintext) {
  const key = randomBytes(32)
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return { key, nonce: iv, ciphertext: encrypted }
}

function hex(buf) {
  return Buffer.from(buf).toString('hex')
}

app.post('/encrypt-upload', upload.single('file'), async (req, res) => {
  try {
    // Validate request body
    const validation = encryptUploadSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      })
    }

    const buffer = req.file ? req.file.buffer : Buffer.from(req.body.data || '', 'utf8')
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'No data provided' })
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
    }

    const { key, nonce, ciphertext } = encryptBuffer(buffer)
    
    // Upload to Pinata
    const { IpfsHash } = await pinata.pinJSONToIPFS({
      type: 'shadow-encrypted-binary',
      payload: ciphertext.toString('base64'),
    })

    const salt = randomBytes(16)
    const policyId = req.body.policyId || 'policy_v1'
    const provider = (req.body.provider || '').toLowerCase()
    const commitPreimage = Buffer.concat([
      salt,
      Buffer.from(policyId),
      ciphertext,
      Buffer.from(provider.replace(/^0x/, ''), 'hex') || Buffer.alloc(0),
    ])
    const commitHash = '0x' + Buffer.from(sha256(commitPreimage)).toString('hex')

    return res.json({
      success: true,
      cid: IpfsHash,
      commitHash,
      salt: '0x' + hex(salt),
      key: key.toString('base64'),
      nonce: '0x' + hex(nonce),
      size: buffer.length,
    })
  } catch (err) {
    console.error('Encrypt upload error:', err)
    
    if (err.message?.includes('Pinata')) {
      return res.status(503).json({ error: 'IPFS service temporarily unavailable' })
    }
    
    return res.status(500).json({ 
      error: 'Encrypt upload failed',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    })
  }
})

// IPFS retrieval endpoint
app.get('/ipfs/:cid', async (req, res) => {
  try {
    const { cid } = req.params
    const { key, nonce } = req.query

    // Validate CID
    if (!cid || cid.length < 10) {
      return res.status(400).json({ error: 'Invalid CID' })
    }

    // For now, return the CID - in production, you'd fetch from Pinata gateway
    // and decrypt if key/nonce provided
    if (key && nonce) {
      // TODO: Implement decryption logic
      return res.json({
        success: true,
        cid,
        message: 'Decryption not yet implemented',
        data: null
      })
    }

    // Return basic CID info
    return res.json({
      success: true,
      cid,
      message: 'Use Pinata gateway to fetch data',
      gateway: `https://gateway.pinata.cloud/ipfs/${cid}`
    })
  } catch (err) {
    console.error('IPFS retrieve error:', err)
    return res.status(500).json({ 
      error: 'Failed to retrieve from IPFS',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    })
  }
})

// Decrypt endpoint for verified buyers
app.post('/decrypt', async (req, res) => {
  try {
    const { cid, key, nonce } = req.body

    const validation = ipfsRetrieveSchema.safeParse({ cid, key, nonce })
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      })
    }

    if (!key || !nonce) {
      return res.status(400).json({ error: 'Key and nonce required for decryption' })
    }

    // TODO: Implement actual decryption
    // 1. Fetch encrypted data from Pinata gateway
    // 2. Decrypt using provided key and nonce
    // 3. Return decrypted data

    return res.json({
      success: true,
      message: 'Decryption endpoint ready - implementation pending',
      cid,
      decrypted: false
    })
  } catch (err) {
    console.error('Decrypt error:', err)
    return res.status(500).json({ 
      error: 'Decryption failed',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    })
  }
})

app.get('/health', (_req, res) => res.json({ 
  ok: true, 
  timestamp: new Date().toISOString(),
  service: 'shadow-storage'
}))

const port = process.env.PORT || 8787
app.listen(port, () => console.log(`shadow-storage running on :${port}`))


