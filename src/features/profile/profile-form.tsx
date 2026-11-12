import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Skeleton } from '@/components/ui/skeleton'
import { passwordRule } from '@/features/auth/schemas'
import { useProfile, useUpdateProfile } from './api'

const schema = z
  .object({
    displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres.'),
    username: z.string().trim().min(3, 'Mínimo de 3 caracteres.').regex(/^[a-z0-9_.]+$/i, 'Use letras, números, "_" ou ".".'),
    email: z.string().trim().email('E-mail inválido.'),
    ensName: z.string().trim().regex(/^[a-z0-9-]*$/i, 'Somente letras, números e hífen.').min(1, 'Informe o nome ENS.'),
    walletNickname: z.string().trim().min(1, 'Informe um apelido.'),
    currentPassword: z.string().optional(),
    newPassword: z.union([z.literal(''), passwordRule]).optional(),
    confirmPassword: z.string().optional(),
  })
  .refine((d) => !d.newPassword || d.currentPassword, { path: ['currentPassword'], message: 'Informe a senha atual.' })
  .refine((d) => (d.newPassword ?? '') === (d.confirmPassword ?? ''), { path: ['confirmPassword'], message: 'As senhas não coincidem.' })

type Values = z.infer<typeof schema>

export function ProfileForm() {
  const { data: profile, isPending } = useProfile()
  const update = useUpdateProfile()
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const { errors } = form.formState

  useEffect(() => {
    if (profile)
      form.reset({
        displayName: profile.displayName,
        username: profile.username,
        email: profile.email,
        ensName: profile.ensName,
        walletNickname: profile.walletNickname,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }, { keepDirtyValues: true })
  }, [profile, form])

  if (isPending) return <Skeleton className="h-[32rem] w-full" />

  const onSubmit = form.handleSubmit(({ confirmPassword: _c, newPassword, currentPassword, ...rest }) =>
    update.mutate(
      { ...rest, ...(newPassword ? { newPassword, currentPassword } : {}) },
      {
        onSuccess: () => {
          toast.success('Perfil atualizado!')
          form.resetField('currentPassword', { defaultValue: '' })
          form.resetField('newPassword', { defaultValue: '' })
          form.resetField('confirmPassword', { defaultValue: '' })
        },
        onError: (e) => {
          if (e.field) form.setError(e.field as keyof Values, { message: e.message })
          else toast.error(e.message)
        },
      },
    ),
  )

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="profile-heading" className="max-w-2xl">
      <h1 id="profile-heading" className="mb-5 text-xs font-bold">
        Perfil do colecionador
      </h1>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          <Input className="h-9" autoComplete="name" {...form.register('displayName')} />
        </Field>
        <Field label="Nome de usuário" required error={errors.username?.message}>
          <Input className="h-9" autoComplete="username" {...form.register('username')} />
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          <Input className="h-9" type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          <div className="flex gap-2">
            <span className="flex h-9 items-center rounded-md border border-input px-2 text-xs text-muted">.eth</span>
            <Input className="h-9" {...form.register('ensName')} aria-label="Nome ENS" />
          </div>
        </Field>
        <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
          <Input className="h-9" {...form.register('walletNickname')} />
        </Field>
        <AvatarField avatarUrl={profile?.avatarUrl} name={profile?.displayName ?? ''} />
      </div>

      <fieldset className="mt-8 max-w-sm space-y-4">
        <legend className="mb-4 text-xs font-bold">Alterar senha</legend>
        <Field label="Senha atual" error={errors.currentPassword?.message}>
          <PasswordInput className="h-9" autoComplete="current-password" {...form.register('currentPassword')} />
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message}>
          <PasswordInput className="h-9" autoComplete="new-password" {...form.register('newPassword')} />
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
          <PasswordInput className="h-9" autoComplete="new-password" {...form.register('confirmPassword')} />
        </Field>
      </fieldset>
      <Button type="submit" size="sm" className="mt-6 px-8" loading={update.isPending}>
        Salvar
      </Button>
    </form>
  )
}

const AVATAR_SIZE = 128
const MAX_SOURCE_BYTES = 5 * 1024 * 1024

/** Lê a imagem escolhida e a reduz para 128×128 (recorte central) em JPEG. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Avatar: upload real para a API simulada (persistido no perfil) e remoção. */
function AvatarField({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  const update = useUpdateProfile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  const inputId = useId()

  const save = (value: string | null, success: string) => {
    setError(null)
    update.mutate(
      { avatarUrl: value },
      {
        onSuccess: () => toast.success(success),
        onError: (e) => setError(e.message),
      },
    )
  }

  const onFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Selecione um arquivo de imagem (PNG, JPEG, WebP ou GIF).')
    if (file.size > MAX_SOURCE_BYTES) return setError('A imagem deve ter no máximo 5 MB.')
    try {
      save(await toAvatarDataUrl(file), 'Avatar atualizado!')
    } catch {
      setError('Não foi possível ler esta imagem.')
    }
  }

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-labelledby={`${inputId}-label`}>
      <span id={`${inputId}-label`} className="font-mono text-xs font-medium">
        Avatar
      </span>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Avatar de ${name}`} width={36} height={36} className="size-9 rounded-full object-cover" data-testid="avatar-image" />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-primary" aria-hidden>
            <ImageIcon className="size-4" />
          </span>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-label="Arquivo do avatar"
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" size="sm" loading={update.isPending} onClick={() => inputRef.current?.click()}>
          Alterar
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!avatarUrl || update.isPending} onClick={() => save(null, 'Avatar removido.')}>
          Remover
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
