const STORAGE_API_URL = process.env.NEXT_PUBLIC_STORAGE_API_URL || 'https://skal.onrender.com'

export interface EncryptUploadResponse {
  success: boolean
  cid: string
  commitHash: string
  salt: string
  key: string
  nonce: string
  size: number
}

export interface IPFSRetrieveResponse {
  success: boolean
  cid: string
  message: string
  gateway?: string
  data?: any
}

export interface DecryptResponse {
  success: boolean
  message: string
  cid: string
  decrypted: boolean
  data?: any
}

export class StorageClient {
  private baseUrl: string

  constructor(baseUrl: string = STORAGE_API_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Encrypt and upload data to IPFS
   */
  async encryptAndUpload(
    data: string | File,
    options: {
      policyId?: string
      provider?: string
    } = {}
  ): Promise<EncryptUploadResponse> {
    const formData = new FormData()
    
    if (data instanceof File) {
      formData.append('file', data)
    } else {
      formData.append('data', data)
    }
    
    if (options.policyId) {
      formData.append('policyId', options.policyId)
    }
    
    if (options.provider) {
      formData.append('provider', options.provider)
    }

    const response = await fetch(`${this.baseUrl}/encrypt-upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Retrieve data from IPFS
   */
  async fetchFromIPFS(cid: string): Promise<IPFSRetrieveResponse> {
    const response = await fetch(`${this.baseUrl}/ipfs/${cid}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Decrypt data from IPFS
   */
  async decryptData(
    cid: string,
    key: string,
    nonce: string
  ): Promise<DecryptResponse> {
    const response = await fetch(`${this.baseUrl}/decrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cid, key, nonce }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Check if storage service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      const data = await response.json()
      return data.ok === true
    } catch {
      return false
    }
  }

  /**
   * Get Pinata gateway URL for a CID
   */
  getGatewayURL(cid: string): string {
    return `https://gateway.pinata.cloud/ipfs/${cid}`
  }
}

// Export singleton instance
export const storageClient = new StorageClient()

// Export utility functions
export const encryptAndUpload = (data: string | File, options?: Parameters<StorageClient['encryptAndUpload']>[1]) =>
  storageClient.encryptAndUpload(data, options)

export const fetchFromIPFS = (cid: string) =>
  storageClient.fetchFromIPFS(cid)

export const decryptData = (cid: string, key: string, nonce: string) =>
  storageClient.decryptData(cid, key, nonce)

export const healthCheck = () =>
  storageClient.healthCheck()
