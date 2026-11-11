import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

export const passwordRule = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra.')
  .regex(/\d/, 'Inclua ao menos um número.')

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Mínimo de 3 caracteres.')
      .max(24, 'Máximo de 24 caracteres.')
      .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, "_" ou ".".'),
    email: z.string().trim().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
