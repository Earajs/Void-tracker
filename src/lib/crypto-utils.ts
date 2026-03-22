import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

export class CryptoUtil {
  private static getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set')
    }
    return crypto.scryptSync(key, 'salt', 32)
  }

  public static encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }

  public static decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format')
    }

    const [ivHex, authTagHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}
