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
  key: z.string().optional(),
  nonce: z.string().optional(),
})

const ipfsRetrieveSchema = z.object({
  cid: z.string().min(1),
  key: z.string().optional(),
  nonce: z.string().optional(),
})

function encryptBuffer(plaintext, customKey = null, customNonce = null) {
  const key = customKey ? Buffer.from(customKey, 'hex') : randomBytes(32)
  const iv = customNonce ? Buffer.from(customNonce, 'hex') : randomBytes(12) // ChaCha20-Poly1305 uses 12-byte nonce
  const cipher = createCipheriv('chacha20-poly1305', key, iv)
  let encrypted = cipher.update(plaintext)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const authTag = cipher.getAuthTag() // Get the authentication tag
  return { key, nonce: iv, ciphertext: encrypted, authTag }
}

function hex(buf) {
  return Buffer.from(buf).toString('hex')
}

function decryptBuffer(ciphertext, key, nonce, authTag = null) {
  const decipher = createDecipheriv('chacha20-poly1305', key, nonce)
  if (authTag) {
    decipher.setAuthTag(authTag)
  }
  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted
}

// Old decryption function for backward compatibility (tries multiple algorithms)
function decryptBufferOld(ciphertext, key, nonce) {
  console.log('Trying backward compatibility decryption with nonce length:', nonce.length)
  
  // Try different approaches based on nonce length
  const attempts = []
  
  // For 12-byte nonce, try ChaCha20-Poly1305 and AES-256-GCM
  if (nonce.length === 12) {
    attempts.push(
      { name: 'ChaCha20-Poly1305', algo: 'chacha20-poly1305', iv: nonce },
      { name: 'AES-256-GCM', algo: 'aes-256-gcm', iv: nonce }
    )
  }
  
  // For 16-byte nonce, try AES-256-CBC
  if (nonce.length === 16) {
    attempts.push(
      { name: 'AES-256-CBC', algo: 'aes-256-cbc', iv: nonce }
    )
  }
  
  // For 24-byte nonce (extended), try different approaches
  if (nonce.length === 24) {
    // Try using first 12 bytes as nonce
    const nonce12 = nonce.slice(0, 12)
    attempts.push(
      { name: 'ChaCha20-Poly1305 (12-byte)', algo: 'chacha20-poly1305', iv: nonce12 },
      { name: 'AES-256-GCM (12-byte)', algo: 'aes-256-gcm', iv: nonce12 }
    )
    
    // Try using first 16 bytes as IV
    const iv16 = nonce.slice(0, 16)
    attempts.push(
      { name: 'AES-256-CBC (16-byte)', algo: 'aes-256-cbc', iv: iv16 }
    )
  }
  
  // Always try AES-256-CBC with padded nonce as fallback
  if (nonce.length === 12) {
    const paddedIv = Buffer.concat([nonce, Buffer.alloc(4)])
    attempts.push(
      { name: 'AES-256-CBC (padded)', algo: 'aes-256-cbc', iv: paddedIv }
    )
  }
  
  // Try each algorithm
  for (const attempt of attempts) {
    try {
      console.log(`Trying ${attempt.name}...`)
      const decipher = createDecipheriv(attempt.algo, key, attempt.iv)
      let decrypted = decipher.update(ciphertext)
      decrypted = Buffer.concat([decrypted, decipher.final()])
      console.log(`${attempt.name} succeeded!`)
      return decrypted
    } catch (error) {
      console.log(`${attempt.name} failed:`, error.message)
    }
  }
  
  throw new Error(`All decryption methods failed. Tried ${attempts.length} algorithms.`)
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

    // Use custom key/nonce if provided, otherwise generate random ones
    const customKey = req.body.key
    const customNonce = req.body.nonce
    const { key, nonce, ciphertext, authTag } = encryptBuffer(buffer, customKey, customNonce)
    
    // Upload to Pinata with authTag included
    const { IpfsHash } = await pinata.pinJSONToIPFS({
      type: 'shadow-encrypted-binary',
      payload: ciphertext.toString('base64'),
      authTag: authTag.toString('base64'),
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
      authTag: authTag.toString('base64'),
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

    // Fetch encrypted data from Pinata gateway
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`
    const response = await fetch(gatewayUrl)
    
    if (!response.ok) {
      return res.status(404).json({ 
        error: 'Data not found on IPFS',
        message: 'The requested data could not be retrieved from IPFS'
      })
    }

    const encryptedData = await response.json()
    
    console.log('Retrieved data from IPFS:', {
      hasPayload: !!encryptedData.payload,
      hasAuthTag: !!encryptedData.authTag,
      payloadLength: encryptedData.payload?.length,
      authTagLength: encryptedData.authTag?.length,
      dataKeys: Object.keys(encryptedData)
    })
    
    // Check if payload is suspiciously small (might be a different format)
    const payloadSize = Buffer.from(encryptedData.payload, 'base64').length
    console.log('Decoded payload size:', payloadSize, 'bytes')
    
    if (payloadSize < 16) {
      console.log('⚠️  Payload is very small, might be a different encryption format')
    }
    
    if (!encryptedData.payload) {
      return res.status(400).json({ 
        error: 'Invalid data format',
        message: 'The data on IPFS is not in the expected format'
      })
    }

    // Decrypt the data
    const ciphertext = Buffer.from(encryptedData.payload, 'base64')
    const keyBuffer = Buffer.from(key, 'hex')
    const nonceBuffer = Buffer.from(nonce, 'hex')
    
    // Handle different authTag formats
    let authTag = null
    if (encryptedData.authTag) {
      try {
        // Try base64 first
        authTag = Buffer.from(encryptedData.authTag, 'base64')
        console.log('AuthTag from base64, length:', authTag.length)
      } catch (error) {
        try {
          // Try hex if base64 fails
          authTag = Buffer.from(encryptedData.authTag, 'hex')
          console.log('AuthTag from hex, length:', authTag.length)
        } catch (error2) {
          console.log('Could not parse authTag:', error2.message)
          authTag = null
        }
      }
    }
    
    let decryptedBuffer
    try {
      console.log('Attempting decryption with key length:', keyBuffer.length, 'nonce length:', nonceBuffer.length, 'authTag:', !!authTag)
      console.log('Key (first 16 chars):', key.slice(0, 16), 'Nonce (first 16 chars):', nonce.slice(0, 16))
      
      // Validate key and nonce lengths
      if (keyBuffer.length !== 32) {
        throw new Error(`Invalid key length: ${keyBuffer.length}, expected 32`)
      }
      if (nonceBuffer.length !== 12) {
        throw new Error(`Invalid nonce length: ${nonceBuffer.length}, expected 12`)
      }
      
      // Try with authTag first (new format)
      if (authTag) {
        console.log('Trying new format with authTag...')
        console.log('AuthTag length:', authTag.length, 'Expected: 16 for ChaCha20-Poly1305')
        
        // Try ChaCha20-Poly1305 with authTag
        try {
          decryptedBuffer = decryptBuffer(ciphertext, keyBuffer, nonceBuffer, authTag)
          console.log('New format decryption successful!')
        } catch (error) {
          console.log('ChaCha20-Poly1305 with authTag failed:', error.message)
          
          // If authTag is 12 bytes, it might be a different format
          if (authTag.length === 12) {
            console.log('AuthTag is 12 bytes, trying different approach...')
            // Try using the authTag as additional nonce data
            const extendedNonce = Buffer.concat([nonceBuffer, authTag])
            console.log('Trying with extended nonce (24 bytes)...')
            decryptedBuffer = decryptBufferOld(ciphertext, keyBuffer, extendedNonce)
            console.log('Extended nonce decryption successful!')
          } else {
            throw error
          }
        }
      } else {
        console.log('No authTag found, trying old format...')
        // Fallback to old format without authTag (backward compatibility)
        decryptedBuffer = decryptBufferOld(ciphertext, keyBuffer, nonceBuffer)
        console.log('Old format decryption successful!')
      }
    } catch (error) {
      console.log('Decryption with authTag failed, trying old format:', error.message)
      // If new format fails, try old format
      try {
        decryptedBuffer = decryptBufferOld(ciphertext, keyBuffer, nonceBuffer)
        console.log('Fallback decryption successful!')
      } catch (fallbackError) {
        console.error('All decryption methods failed:', fallbackError.message)
        throw new Error('Unable to decrypt data with any supported method')
      }
    }
    
    const decryptedData = decryptedBuffer.toString('utf8')

    return res.json({
      success: true,
      cid,
      data: decryptedData,
      size: decryptedBuffer.length
    })
  } catch (err) {
    console.error('Decrypt error:', err)
    
    if (err.message?.includes('Invalid key') || err.message?.includes('bad decrypt')) {
      return res.status(400).json({ 
        error: 'Decryption failed',
        message: 'Invalid key or nonce provided'
      })
    }
    
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


