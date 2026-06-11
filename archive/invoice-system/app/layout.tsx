import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GS International Trading - Invoice System',
  description: 'Professional invoice generation system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
