import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import pinataSDK from '@pinata/sdk'
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from 'crypto'
import { sha256 } from '@noble/hashes/sha256'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const upload = multer({ storage: multer.memoryStorage() })

const pinata = new pinataSDK({
  pinataJWTKey: process.env.PINATA_JWT,
})

function encryptBuffer(plaintext) {
  const key = randomBytes(32)
  const nonce = randomBytes(24)
  const aead = xchacha20poly1305(key)
  const ciphertext = Buffer.from(aead.seal(nonce, plaintext))
  return { key, nonce, ciphertext }
}

function hex(buf) {
  return Buffer.from(buf).toString('hex')
}

app.post('/encrypt-upload', upload.single('file'), async (req, res) => {
  try {
    const buffer = req.file ? req.file.buffer : Buffer.from(req.body.data || '', 'utf8')
    if (!buffer || buffer.length === 0) return res.status(400).json({ error: 'No data provided' })

    const { key, nonce, ciphertext } = encryptBuffer(buffer)
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
      cid: IpfsHash,
      commitHash,
      salt: '0x' + hex(salt),
      key: key.toString('base64'),
      nonce: '0x' + hex(nonce),
      size: buffer.length,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'encrypt-upload failed' })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

const port = process.env.PORT || 8787
app.listen(port, () => console.log(`shadow-storage running on :${port}`))


