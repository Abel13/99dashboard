import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = { title: '99Dashboard', description: 'Radar moderno de oportunidades 99Freelas' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR" suppressHydrationWarning><body className={montserrat.variable}><ThemeProvider attribute="class" defaultTheme="light" enableSystem>{children}</ThemeProvider></body></html>
}
