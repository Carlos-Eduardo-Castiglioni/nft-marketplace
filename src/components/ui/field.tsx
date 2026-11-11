import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  label?: string
  /** rótulo apenas para leitores de tela (quando o design usa placeholder) */
  srLabel?: boolean
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactElement<Record<string, unknown>>
}

/** Liga label, descrição e erro ao controle via aria-* automaticamente. */
export function Field({ label, srLabel, required, error, hint, className, children }: FieldProps) {
  const autoId = React.useId()
  const id = (children.props.id as string | undefined) ?? autoId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={id} required={required} className={srLabel ? 'sr-only' : undefined}>
          {label}
        </Label>
      )}
      {React.cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
