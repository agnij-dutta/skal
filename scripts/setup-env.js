#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envContent = `# Skal Shadow Protocol Environment Variables
# This file contains sensitive configuration for the application

# App Secret for deterministic key generation
# This ensures both provider and buyer generate the same encryption keys
NEXT_PUBLIC_APP_SECRET=skal-shadow-protocol-secret-key-2024

# Storage API URL (adjust if running on different port)
NEXT_PUBLIC_STORAGE_API_URL=http://localhost:8787

# Add other environment variables as needed
`;

const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local file with default configuration');
  console.log('📝 Please review and update the environment variables as needed');
} else {
  console.log('⚠️  .env.local already exists, skipping creation');
}

console.log('\n🔧 Environment setup complete!');
console.log('🚀 You can now run the application with proper encryption key generation.');
