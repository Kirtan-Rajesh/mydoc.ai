'use client'

import { useEffect, useState } from 'react'
import { Check, Crown, FileText, MessageCircle, Users, Zap } from 'lucide-react'
import { getSubscription, type SubscriptionOut } from '@/lib/api'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    color: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
    features: [
      '25 health documents',
      '20 AI chats per day',
      'Medication reminders',
      'Basic AI summaries',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹199',
    period: 'per month',
    color: 'border-brand-500',
    badge: 'bg-brand-600 text-white',
    highlight: true,
    features: [
      'Unlimited documents',
      'Unlimited AI chats',
      'Priority AI processing',
      'Detailed health insights',
      'Download reports',
      'Email support',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    price: '₹349',
    period: 'per month',
    color: 'border-purple-400',
    badge: 'bg-purple-600 text-white',
    features: [
      'Everything in Pro',
      'Up to 6 family members',
      'Shared family dashboard',
      'Per-member health profiles',
      'Priority support',
    ],
  },
]

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-400' : 'bg-brand-500'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function SubscriptionsPage() {
  const [sub, setSub] = useState<SubscriptionOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSubscription().then(setSub).catch((e) => setError(String(e)))
  }, [])

  const handleUpgrade = (planId: string) => {
    // Razorpay integration: open checkout
    alert(`Razorpay checkout for ${planId} plan — integration coming soon.`)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex h-16 items-center border-b border-gray-100 bg-white px-6">
        <h1 className="font-bold">Subscription</h1>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Current usage */}
        {sub && (
          <div className="rounded-3xl bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-3">
              <Crown size={20} className="text-brand-600" />
              <div>
                <h2 className="font-bold capitalize">{sub.plan} plan</h2>
                <p className="text-xs text-gray-400">Current billing period</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-500">
                    <FileText size={12} /> Documents
                  </span>
                  <span className="font-semibold">{sub.doc_count} / {sub.limits.documents}</span>
                </div>
                <ProgressBar value={sub.doc_count} max={sub.limits.documents} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-500">
                    <MessageCircle size={12} /> AI chats today
                  </span>
                  <span className="font-semibold">{sub.chat_count_today} / {sub.limits.daily_chats}</span>
                </div>
                <ProgressBar value={sub.chat_count_today} max={sub.limits.daily_chats} />
              </div>
            </div>
            {sub.plan === 'free' && sub.doc_count >= sub.limits.documents * 0.8 && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                You&apos;re approaching your document limit. Upgrade to Pro for unlimited storage.
              </p>
            )}
          </div>
        )}

        {/* Plan cards */}
        <div>
          <h2 className="mb-4 font-bold">Available plans</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = sub?.plan === plan.id
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl border-2 bg-white p-6 ${plan.color} ${plan.highlight ? 'shadow-lg' : 'shadow-soft'}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                        Most popular
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${plan.badge}`}>
                      {plan.name}
                    </span>
                    <div className="mt-3">
                      <span className="text-3xl font-extrabold">{plan.price}</span>
                      <span className="ml-1 text-sm text-gray-400">/{plan.period}</span>
                    </div>
                  </div>

                  <ul className="mb-6 flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check size={14} className="mt-0.5 shrink-0 text-brand-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="rounded-xl bg-gray-50 py-2.5 text-center text-sm font-semibold text-gray-400">
                      Current plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                        plan.highlight
                          ? 'bg-brand-600 text-white hover:bg-brand-700'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Features comparison */}
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="mb-4 font-bold">Why upgrade?</h2>
          <div className="space-y-4">
            {[
              {
                icon: FileText,
                title: 'Unlimited health records',
                desc: 'Store all your lab reports, prescriptions, and scans without hitting limits.',
              },
              {
                icon: Zap,
                title: 'Priority AI processing',
                desc: 'Your reports are analysed first — get summaries in seconds, not minutes.',
              },
              {
                icon: MessageCircle,
                title: 'Unlimited AI conversations',
                desc: 'Ask as many health questions as you need, any time of day.',
              },
              {
                icon: Users,
                title: 'Family plan (₹349/mo)',
                desc: 'Manage health records for your parents, spouse, and children — one subscription.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="pb-4 text-center text-xs text-gray-400">
          Payments processed by Razorpay · Secure UPI, card, and netbanking · Cancel anytime
        </p>
      </div>
    </div>
  )
}
