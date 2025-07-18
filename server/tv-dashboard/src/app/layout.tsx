import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import ThemeRegistry from '@/components/ThemeRegistry'
import './globals.css'

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '3CX Call Center Dashboard',
  description: 'Real-time call center monitoring dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  )
}