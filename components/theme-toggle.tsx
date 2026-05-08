'use client'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from './ui/button'
export function ThemeToggle(){const {theme,setTheme}=useTheme();return <Button onClick={()=>setTheme(theme==='dark'?'light':'dark')}><Sun size={16}/><Moon size={16}/> Tema</Button>}
