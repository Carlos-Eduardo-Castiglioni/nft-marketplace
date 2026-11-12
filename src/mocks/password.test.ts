import { hashPassword, sha256, verifyPassword } from './password'

describe('password (mock)', () => {
  it('sha256 confere com vetores conhecidos', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3')
  })

  it('nunca guarda a senha em claro e verifica com salt', () => {
    const stored = hashPassword('Kurio@123', 'salt-1')
    expect(JSON.stringify(stored)).not.toContain('Kurio@123')
    expect(verifyPassword('Kurio@123', stored)).toBe(true)
    expect(verifyPassword('kurio@123', stored)).toBe(false)
    expect(hashPassword('Kurio@123', 'salt-2').hash).not.toBe(stored.hash)
  })
})
