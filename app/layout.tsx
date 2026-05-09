import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { AppQueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = { title: '99Dashboard', description: 'Radar moderno de oportunidades 99Freelas' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR" suppressHydrationWarning><body className={montserrat.variable}><AppQueryProvider><ThemeProvider>{children}</ThemeProvider></AppQueryProvider></body></html>
}
