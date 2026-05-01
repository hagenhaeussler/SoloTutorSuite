import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto'

const VERSION = 'v1'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey() {
  const rawKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY

  if (!rawKey) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is not configured')
  }

  const trimmed = rawKey.trim()
  const base64Key = Buffer.from(trimmed, 'base64')
  if (base64Key.length === 32 && base64Key.toString('base64').replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
    return base64Key
  }

  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  return createHash('sha256').update(trimmed).digest()
}

export function encryptToken(token: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export function decryptToken(payload: string) {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = payload.split(':')

  if (version !== VERSION || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error('Invalid encrypted token payload')
  }

  const iv = Buffer.from(ivEncoded, 'base64url')
  const authTag = Buffer.from(tagEncoded, 'base64url')
  const encrypted = Buffer.from(encryptedEncoded, 'base64url')

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted token payload')
  }

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function secureCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)

  if (aBuffer.length !== bBuffer.length) {
    return false
  }

  return timingSafeEqual(aBuffer, bBuffer)
}
