/**
 * Shared cryptographic utilities for deterministic key generation
 * Ensures both provider and buyer generate the same encryption keys
 */

/**
 * Generate a deterministic encryption key based on provider address and task ID
 * This ensures both provider and buyer generate the same key
 * Returns a 64-character hex string (32 bytes) for ChaCha20-Poly1305
 */
export async function generateDeterministicKey(providerAddress: string, taskId: number): Promise<string> {
  const appSecret = process.env.NEXT_PUBLIC_APP_SECRET || 'skal-default-secret'
  const seed = `skal-key-${providerAddress}-${taskId}-${appSecret}`
  const encoder = new TextEncoder()
  const data = encoder.encode(seed)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a deterministic nonce based on provider address and task ID
 * Returns a 24-character hex string (12 bytes) for ChaCha20-Poly1305
 */
export async function generateDeterministicNonce(providerAddress: string, taskId: number): Promise<string> {
  const appSecret = process.env.NEXT_PUBLIC_APP_SECRET || 'skal-default-secret'
  const seed = `skal-nonce-${providerAddress}-${taskId}-${appSecret}`
  const encoder = new TextEncoder()
  const data = encoder.encode(seed)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

/**
 * Generate a deterministic salt for additional security
 */
export async function generateDeterministicSalt(providerAddress: string, taskId: number): Promise<string> {
  const appSecret = process.env.NEXT_PUBLIC_APP_SECRET || 'skal-default-secret'
  const seed = `skal-salt-${providerAddress}-${taskId}-${appSecret}`
  const encoder = new TextEncoder()
  const data = encoder.encode(seed)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

/**
 * Validate that the generated key is properly formatted
 */
export function validateKey(key: string): boolean {
  return /^[a-f0-9]{64}$/.test(key)
}

/**
 * Validate that the generated nonce is properly formatted
 */
export function validateNonce(nonce: string): boolean {
  return /^[a-f0-9]{24}$/.test(nonce)
}
