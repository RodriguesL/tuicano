// Connector credentials (tokens, OAuth state, env values) are encrypted before
// they reach SQLite. The OS keychain lives outside the core, so whoever hosts it
// supplies the cipher (see src/host).
import type { Db } from './db'

export interface Cipher {
  encrypt(plain: string): Promise<string>
  decrypt(sealed: string): Promise<string>
}

// For tests and the fake mode: marks values as unencrypted instead of pretending.
export const plainCipher: Cipher = {
  encrypt: async (s) => `plain:${s}`,
  decrypt: async (s) => s.replace(/^plain:/, '')
}

export class Secrets {
  constructor(
    private db: Db,
    private cipher: Cipher
  ) {}

  async get(key: string): Promise<string | undefined> {
    const sealed = this.db.getSecret(key)
    return sealed === undefined ? undefined : this.cipher.decrypt(sealed)
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const v = await this.get(key)
    return v === undefined ? undefined : (JSON.parse(v) as T)
  }

  async set(key: string, value: string | undefined): Promise<void> {
    this.db.setSecret(key, value === undefined ? undefined : await this.cipher.encrypt(value))
  }

  setJson(key: string, value: unknown): Promise<void> {
    return this.set(key, value === undefined ? undefined : JSON.stringify(value))
  }
}
