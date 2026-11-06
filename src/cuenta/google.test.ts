import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { nuevoNonce } from './google'

describe('nonce para entrar con Google', () => {
  it('Google recibe el SHA-256 del nonce que después se le da a Supabase', async () => {
    const { crudo, hash } = await nuevoNonce()
    expect(crudo).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(createHash('sha256').update(crudo).digest('hex'))
  })

  it('cada petición lleva un nonce distinto', async () => {
    const [a, b] = await Promise.all([nuevoNonce(), nuevoNonce()])
    expect(a.crudo).not.toBe(b.crudo)
  })
})
