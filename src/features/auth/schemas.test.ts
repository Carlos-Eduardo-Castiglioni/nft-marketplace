import { loginSchema, registerSchema } from './schemas'

describe('auth schemas', () => {
  it('valida login', () => {
    expect(loginSchema.safeParse({ email: 'x', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'contato@email.com', password: 'a' }).success).toBe(true)
  })

  it('exige senhas iguais e fortes no cadastro', () => {
    const base = { username: 'nova', email: 'n@k.io', password: 'abc12345', confirmPassword: 'abc12345' }
    expect(registerSchema.safeParse(base).success).toBe(true)
    const mismatch = registerSchema.safeParse({ ...base, confirmPassword: 'x' })
    expect(mismatch.success).toBe(false)
    expect(mismatch.error?.issues[0].path).toEqual(['confirmPassword'])
    expect(registerSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, username: 'a b' }).success).toBe(false)
  })
})
