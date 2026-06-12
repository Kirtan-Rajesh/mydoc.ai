'use client'

import { useEffect, useState } from 'react'
import { AlarmClock, Pill, Plus, Trash2 } from 'lucide-react'
import {
  createMedication,
  deleteMedication,
  getMedications,
  type MedicationOut,
} from '@/lib/api'

export default function MedicationsPage() {
  const [meds, setMeds] = useState<MedicationOut[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [instructions, setInstructions] = useState('')
  const [times, setTimes] = useState('08:00')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => getMedications().then(setMeds).catch((e) => setError(String(e)))

  useEffect(() => {
    refresh()
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createMedication({
        name,
        dosage,
        instructions,
        times: times
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      setName('')
      setDosage('')
      setInstructions('')
      setTimes('08:00')
      setAdding(false)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <div className="min-h-screen">
      <div className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6">
        <h1 className="font-bold">Medicines</h1>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Add medicine
        </button>
      </div>

      <div className="mx-auto max-w-3xl p-6">
        {adding && (
          <form onSubmit={add} className="mb-6 rounded-3xl bg-white p-6 shadow-soft">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Medicine name *"
                required
                className="rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none"
              />
              <input
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="Dosage (500mg)"
                className="rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none"
              />
              <input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions (after food)"
                className="rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none"
              />
              <input
                value={times}
                onChange={(e) => setTimes(e.target.value)}
                placeholder="Times: 08:00, 20:00"
                className="rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none"
              />
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              Save
            </button>
          </form>
        )}

        {!meds ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : meds.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
            <Pill className="mx-auto mb-4 text-gray-300" size={48} />
            <h2 className="font-bold">No medicines yet</h2>
            <p className="mt-1 text-sm text-gray-500">
              Add medicines and times — the mobile app reminds you daily.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {meds.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-soft"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Pill size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {m.name} <span className="font-medium text-gray-500">{m.dosage}</span>
                  </p>
                  {m.instructions && (
                    <p className="text-xs text-gray-500">{m.instructions}</p>
                  )}
                  {m.times.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-700">
                      <AlarmClock size={12} /> {m.times.join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await deleteMedication(m.id)
                    refresh()
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
