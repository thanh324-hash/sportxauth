const assert = require('node:assert/strict')
const { test } = require('node:test')
const { encryptPortableBackup, decryptPortableBackup } = require('./backup-crypto.cjs')

test('portable backup round-trips and does not expose plaintext', () => {
  const value = { tenant:'Cửa hàng 68', secretText:'nội dung riêng', rows:[1,2,3] }
  const encrypted = encryptPortableBackup(value, 'mat-khau-backup-68')
  assert.equal(encrypted.includes('nội dung riêng'), false)
  assert.deepEqual(decryptPortableBackup(encrypted, 'mat-khau-backup-68'), value)
})

test('portable backup rejects weak and incorrect passwords', () => {
  assert.throws(() => encryptPortableBackup({}, '123'))
  const encrypted = encryptPortableBackup({ok:true}, 'mat-khau-dung-68')
  assert.throws(() => decryptPortableBackup(encrypted, 'mat-khau-sai-68'))
})
