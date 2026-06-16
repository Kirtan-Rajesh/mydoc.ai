'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import {
  Crown,
  FileText,
  HeartPulse,
  LogOut,
  MessageCircle,
  Pill,
  User,
} from 'lucide-react'
import { getMe, getToken, setToken, type UserOut } from '@/lib/api'

const nav = [
  { href: '/app/chat', label: 'Ask AI', icon: MessageCircle },
  { href: '/app/records', label: 'Records', icon: FileText },
  { href: '/app/medications', label: 'Medicines', icon: Pill },
  { href: '/app/profile', label: 'Profile', icon: User },
  { href: '/app/subscriptions', label: 'Subscription', icon: Crown },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<UserOut | null>(null)

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }
    getMe().then(setUser).catch(() => {})
  }, [router])

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-gray-100 bg-white">
        <Link href="/" className="flex h-16 items-center gap-2 px-6 font-extrabold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-brand-500 text-white">
            <HeartPulse size={17} />
          </span>
          mydoc.ai
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold',
                pathname.startsWith(item.href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
              {(user?.name?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name || '—'}</p>
              <p className="truncate text-xs text-gray-500">{user?.phone}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setToken(null)
              router.replace('/login')
            }}
            className="flex w-full items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="ml-60 flex-1">{children}</div>
    </div>
  )
}
