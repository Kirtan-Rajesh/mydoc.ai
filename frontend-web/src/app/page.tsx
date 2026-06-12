import Link from 'next/link'
import {
  Activity,
  Bell,
  FileText,
  HeartPulse,
  Languages,
  MessageCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

const features = [
  {
    icon: ScanLine,
    title: 'Scan anything medical',
    text: 'Photograph lab reports, prescriptions, scans and discharge summaries. AI reads, classifies and files them automatically.',
  },
  {
    icon: MessageCircle,
    title: 'Talk to your AI doctor',
    text: 'Ask anything in plain words. Answers are grounded in your own reports — not generic internet advice.',
  },
  {
    icon: Bell,
    title: 'Never miss a dose',
    text: 'Medicines, timings and daily reminders, with adherence tracking your family can see.',
  },
  {
    icon: Activity,
    title: 'Understand your trends',
    text: 'Hemoglobin dropping? Vitamin D recovering? The AI connects values across reports over time.',
  },
  {
    icon: Users,
    title: 'One app for the family',
    text: 'Manage parents’ and children’s records under one account, each with their own health profile.',
  },
  {
    icon: Languages,
    title: '11 Indian languages',
    text: 'From Hindi to Tamil to Bengali — health guidance in the language your family is comfortable in.',
  },
]

const steps = [
  { n: '1', title: 'Scan a report', text: 'Take a photo or upload a PDF. Takes ten seconds.' },
  { n: '2', title: 'AI reads it', text: 'Values extracted, classified and summarised in plain language.' },
  { n: '3', title: 'Just ask', text: '“Is my sugar under control?” — answers from your own records.' },
]

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-brand-500 text-white">
            <HeartPulse size={18} />
          </span>
          mydoc.ai
        </Link>
        <div className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#privacy" className="hover:text-ink">Privacy</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  )
}

export default function Landing() {
  return (
    <main>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-transparent" />
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-soft">
            <Sparkles size={14} /> Your family’s personal AI doctor
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
            Every report understood.
            <br />
            <span className="bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
              Every dose on time.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-600">
            Scan your medical reports and prescriptions. mydoc.ai reads them, explains them
            in plain language, reminds you about medicines, and answers your health
            questions — for life.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-2xl bg-brand-600 px-7 py-3.5 font-semibold text-white shadow-soft transition hover:bg-brand-700"
            >
              Start free
            </Link>
            <a
              href="#how"
              className="rounded-2xl border border-gray-200 bg-white px-7 py-3.5 font-semibold text-gray-700 hover:bg-gray-50"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Free plan • No credit card • Works on Android, iOS and web
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">
          Not a filing cabinet. A doctor’s brain for your records.
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-3xl bg-white p-7 shadow-soft">
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon size={22} />
              </span>
              <h3 className="mb-2 font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">
            Three steps to peace of mind
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 text-lg font-extrabold text-white">
                  {s.n}
                </div>
                <h3 className="mb-2 font-bold">{s.title}</h3>
                <p className="mx-auto max-w-xs text-sm text-gray-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy + CTA */}
      <section id="privacy" className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-500 p-10 text-white md:p-14">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-100">
                <ShieldCheck size={16} /> Private by design
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                Your health data belongs to you.
              </h2>
              <p className="mt-3 text-brand-50">
                Encrypted in transit and at rest. Your reports are used only to answer{' '}
                <em>your</em> questions — never sold, never used to train models.
                mydoc.ai informs and coaches; it never replaces your doctor.
              </p>
            </div>
            <Link
              href="/login"
              className="shrink-0 rounded-2xl bg-white px-7 py-3.5 font-semibold text-brand-700 shadow-soft hover:bg-brand-50"
            >
              Create your vault
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-gray-500 md:flex-row">
          <div className="flex items-center gap-2 font-bold text-ink">
            <FileText size={16} className="text-brand-600" /> mydoc.ai
          </div>
          <p>Not a substitute for professional medical advice, diagnosis or treatment.</p>
          <p>© {new Date().getFullYear()} mydoc.ai</p>
        </div>
      </footer>
    </main>
  )
}
