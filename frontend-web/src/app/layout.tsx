import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'mydoc.ai — your family’s personal AI doctor',
  description:
    'Scan medical reports and prescriptions, get plain-language AI explanations, manage medicines with reminders — in 11 Indian languages.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
