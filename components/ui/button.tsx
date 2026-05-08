import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
export function Button({ className, variant='secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'danger' }) {
  return <button className={cn('btn', variant, className)} {...props} />
}
