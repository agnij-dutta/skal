# Shadow Storage Service

Minimal service to encrypt payloads and pin to IPFS (Pinata).

## Setup

1. Create `.env` with:

```
PORT=8787
PINATA_JWT=your_pinata_jwt
```

2. Install deps and run:

```
cd backend/storage
npm install
npm run dev
```

## API

POST /encrypt-upload (multipart/form-data)
- file: binary file OR data: string
- policyId: string
- provider: 0x...

Response:
```
{ cid, commitHash, salt, key, nonce, size }
```


