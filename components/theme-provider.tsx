'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'light' | 'dark'
type ThemeContextValue = {
  resolvedTheme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const THEME_KEY = '99dashboard-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY)
    const nextTheme: Theme = stored === 'dark' ? 'dark' : 'light'
    setResolvedTheme(nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }, [])

  function setTheme(theme: Theme) {
    setResolvedTheme(theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {}
  }

  const value = useMemo(() => ({ resolvedTheme, setTheme }), [resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
