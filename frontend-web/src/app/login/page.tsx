'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HeartPulse } from 'lucide-react'
import { requestOtp, setToken, verifyOtp } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fullPhone = `+91${phone.replace(/\D/g, '')}`

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const resp = await requestOtp(fullPhone)
      setDevOtp(resp.dev_otp)
      if (resp.dev_otp) setOtp(resp.dev_otp)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const resp = await verifyOtp(fullPhone, otp, name || undefined)
      setToken(resp.access_token)
      router.push('/app/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-[#f7faf9] px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-extrabold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 text-white">
            <HeartPulse size={18} />
          </span>
          mydoc.ai
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-soft">
          {step === 'phone' ? (
            <form onSubmit={sendOtp}>
              <h1 className="text-xl font-extrabold">Sign in</h1>
              <p className="mb-6 mt-1 text-sm text-gray-500">
                We’ll send a one-time code to your mobile.
              </p>
              <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3.5">
                <span className="text-sm font-semibold text-gray-500">+91</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Mobile number"
                  className="w-full bg-transparent text-sm outline-none"
                  autoFocus
                />
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <button
                disabled={busy}
                className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={verify}>
              <h1 className="text-xl font-extrabold">Enter the code</h1>
              <p className="mb-6 mt-1 text-sm text-gray-500">
                Sent to {fullPhone}
                {devOtp && (
                  <span className="ml-1 text-brand-600">(dev mode: {devOtp})</span>
                )}
              </p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                className="w-full rounded-2xl bg-gray-50 px-4 py-3.5 text-center text-lg font-bold tracking-[0.5em] outline-none"
                autoFocus
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (new accounts)"
                className="mt-3 w-full rounded-2xl bg-gray-50 px-4 py-3.5 text-sm outline-none"
              />
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <button
                disabled={busy}
                className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </main>
  )
}
