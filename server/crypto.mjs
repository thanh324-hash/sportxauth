import crypto from 'node:crypto'

const encode = value => Buffer.from(value).toString('base64url')
const decode = value => Buffer.from(value, 'base64url')

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự')
  const hash = crypto.scryptSync(password, salt, 64)
  return `${encode(salt)}.${encode(hash)}`
}

export function verifyPassword(password, stored) {
  const [salt, expected] = stored.split('.')
  if (!salt || !expected) return false
  const actual = crypto.scryptSync(password, decode(salt), 64)
  const expectedBuffer = decode(expected)
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer)
}

export function createSession(payload, secret, ttlSeconds = 60 * 60 * 24 * 7) {
  const body = encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }))
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function readSession(token, secret) {
  const [body, signature] = String(token || '').split('.')
  if (!body || !signature) throw new Error('Phiên đăng nhập không hợp lệ')
  const expected = crypto.createHmac('sha256', secret).update(body).digest()
  const actual = decode(signature)
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Phiên đăng nhập không hợp lệ')
  const payload = JSON.parse(decode(body).toString('utf8'))
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Phiên đăng nhập đã hết hạn')
  return payload
}

function encryptionKey(secret) { return crypto.createHash('sha256').update(secret).digest() }

export function encryptSecret(value, secret) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return `${encode(iv)}.${encode(cipher.getAuthTag())}.${encode(encrypted)}`
}

export function decryptSecret(value, secret) {
  const [iv, tag, encrypted] = String(value).split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(secret), decode(iv))
  decipher.setAuthTag(decode(tag))
  return Buffer.concat([decipher.update(decode(encrypted)), decipher.final()]).toString('utf8')
}
