import path from 'node:path'

export function loadConfig(overrides = {}) {
  const developmentSecret = 'bot68-development-secret-change-before-production'
  return {
    port: Number(process.env.PORT || 6868),
    host: process.env.HOST || '127.0.0.1',
    databasePath: process.env.BOT68_DATABASE || path.resolve('server-data', 'bot68.sqlite'),
    authSecret: process.env.BOT68_AUTH_SECRET || developmentSecret,
    encryptionSecret: process.env.BOT68_ENCRYPTION_SECRET || developmentSecret,
    metaVerifyToken: process.env.META_VERIFY_TOKEN || 'bot68-development-token',
    metaAppId: process.env.META_APP_ID || '',
    metaAppSecret: process.env.META_APP_SECRET || '',
    metaGraphVersion: process.env.META_GRAPH_VERSION || 'v21.0',
    metaRedirectUri: process.env.META_REDIRECT_URI || '',
    aiBaseUrl: (process.env.BOT68_AI_BASE_URL || '').replace(/\/$/,''),
    aiApiKey: process.env.BOT68_AI_API_KEY || '',
    aiModel: process.env.BOT68_AI_MODEL || '',
    fetchImpl: globalThis.fetch,
    publicUrl: (process.env.BOT68_PUBLIC_URL || 'http://127.0.0.1:6868').replace(/\/$/, ''),
    production: process.env.NODE_ENV === 'production',
    ...overrides
  }
}

export function validateProductionConfig(config) {
  if (!config.production) return
  const problems = []
  const weak=value=>typeof value!=='string'||value.length<32||value.includes('development-secret')||value.includes('replace-with')
  if (weak(config.authSecret)) problems.push('BOT68_AUTH_SECRET (random, >=32 chars)')
  if (weak(config.encryptionSecret)||config.encryptionSecret===config.authSecret) problems.push('BOT68_ENCRYPTION_SECRET (different random key, >=32 chars)')
  try { const url=new URL(config.publicUrl);if(url.protocol!=='https:'||['localhost','127.0.0.1','bot68.example.com'].includes(url.hostname))problems.push('BOT68_PUBLIC_URL (real public HTTPS domain)') } catch { problems.push('BOT68_PUBLIC_URL (valid HTTPS URL)') }
  if(Boolean(config.metaAppId)!==Boolean(config.metaAppSecret))problems.push('META_APP_ID + META_APP_SECRET (both required)')
  if(config.metaAppId&&weak(config.metaVerifyToken))problems.push('META_VERIFY_TOKEN (random, >=32 chars)')
  if (problems.length) throw new Error(`Missing secure production configuration: ${problems.join(', ')}`)
}
