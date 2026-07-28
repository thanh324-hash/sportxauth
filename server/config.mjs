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
    publicUrl: (process.env.BOT68_PUBLIC_URL || 'http://127.0.0.1:6868').replace(/\/$/, ''),
    production: process.env.NODE_ENV === 'production',
    ...overrides
  }
}

export function validateProductionConfig(config) {
  if (!config.production) return
  const problems = []
  if (config.authSecret.includes('development-secret')) problems.push('BOT68_AUTH_SECRET')
  if (config.encryptionSecret.includes('development-secret')) problems.push('BOT68_ENCRYPTION_SECRET')
  if (!config.publicUrl.startsWith('https://')) problems.push('BOT68_PUBLIC_URL (HTTPS)')
  if (problems.length) throw new Error(`Missing secure production configuration: ${problems.join(', ')}`)
}
