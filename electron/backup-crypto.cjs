const crypto = require('crypto')

function encryptPortableBackup(value, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 8) throw new Error('Mật khẩu sao lưu phải có ít nhất 8 ký tự')
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), key = crypto.scryptSync(passphrase, salt, 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return JSON.stringify({ magic:'BOT68BACKUP', version:1, kdf:'scrypt', cipher:'aes-256-gcm', salt:salt.toString('base64'), iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), data:encrypted.toString('base64') })
}

function decryptPortableBackup(text, passphrase) {
  const envelope = JSON.parse(text)
  if (envelope?.magic !== 'BOT68BACKUP' || envelope?.version !== 1 || envelope?.kdf !== 'scrypt' || envelope?.cipher !== 'aes-256-gcm') throw new Error('Định dạng sao lưu BOT 68 không hợp lệ')
  const key = crypto.scryptSync(String(passphrase), Buffer.from(envelope.salt, 'base64'), 32)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'))
}

module.exports = { encryptPortableBackup, decryptPortableBackup }
