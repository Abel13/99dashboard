'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { Button } from './ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const Icon = isDark ? Sun : Moon

  return (
    <Button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}>
      <span className="themeIcon" key={isDark ? 'sun' : 'moon'}>
        <Icon size={16} />
      </span>
      Tema
    </Button>
  )
}
