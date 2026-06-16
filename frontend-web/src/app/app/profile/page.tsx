'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import {
  addFamilyMember,
  deleteFamilyMember,
  getFamily,
  getMe,
  getProfile,
  updateMe,
  updateProfile,
  type FamilyMember,
  type HealthProfile,
  type UserOut,
} from '@/lib/api'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other']

export default function ProfilePage() {
  const [user, setUser] = useState<UserOut | null>(null)
  const [profile, setProfile] = useState<HealthProfile | null>(null)
  const [family, setFamily] = useState<FamilyMember[]>([])
  const [editingProfile, setEditingProfile] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Profile form state
  const [bloodGroup, setBloodGroup] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [conditions, setConditions] = useState('')
  const [allergies, setAllergies] = useState('')

  // Family form state
  const [memberName, setMemberName] = useState('')
  const [memberRelation, setMemberRelation] = useState('Spouse')
  const [memberPhone, setMemberPhone] = useState('')

  const flash = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const load = async () => {
    try {
      const [u, p, f] = await Promise.all([getMe(), getProfile(), getFamily()])
      setUser(u)
      setProfile(p)
      setFamily(f)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => { load() }, [])

  const openEdit = () => {
    if (!profile) return
    setBloodGroup(profile.blood_group ?? '')
    setHeightCm(profile.height_cm?.toString() ?? '')
    setWeightKg(profile.weight_kg?.toString() ?? '')
    setConditions(profile.medical_conditions.join(', '))
    setAllergies(profile.allergies.join(', '))
    setEditingProfile(true)
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setError(null)
    try {
      const updated = await updateProfile({
        blood_group: bloodGroup || null,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        medical_conditions: conditions.split(',').map((s) => s.trim()).filter(Boolean),
        allergies: allergies.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setProfile(updated)
      setEditingProfile(false)
      flash('Health profile saved')
    } catch (e) {
      setError(String(e))
    } finally {
      setSavingProfile(false)
    }
  }

  const changeLang = async (code: string) => {
    try {
      const updated = await updateMe({ language_pref: code })
      setUser(updated)
      flash('Language updated')
    } catch (e) {
      setError(String(e))
    }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await addFamilyMember({
        name: memberName,
        relation: memberRelation,
        ...(memberPhone ? { phone: memberPhone } : {}),
      })
      setMemberName('')
      setMemberPhone('')
      setAddingMember(false)
      const f = await getFamily()
      setFamily(f)
      flash('Family member added')
    } catch (e) {
      setError(String(e))
    }
  }

  const removeMember = async (id: string) => {
    try {
      await deleteFamilyMember(id)
      setFamily((prev) => prev.filter((m) => m.id !== id))
      flash('Removed')
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex h-16 items-center border-b border-gray-100 bg-white px-6">
        <h1 className="font-bold">Profile</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* Feedback */}
        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
            <Check size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* User card */}
        <div className="flex items-center gap-4 rounded-3xl bg-white p-6 shadow-soft">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700">
            {(user?.name?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold">{user?.name || '—'}</p>
            <p className="text-sm text-gray-500">{user?.phone}</p>
          </div>
        </div>

        {/* Language */}
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="mb-4 font-bold">Language preference</h2>
          <div className="relative inline-block">
            <select
              value={user?.language_pref ?? 'en'}
              onChange={(e) => changeLang(e.target.value)}
              className="appearance-none rounded-xl bg-gray-50 py-2.5 pl-4 pr-10 text-sm font-semibold outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-gray-400" />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            AI responses will be in this language where possible.
          </p>
        </div>

        {/* Health profile */}
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Health profile</h2>
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              <Pencil size={13} /> Edit
            </button>
          </div>

          {editingProfile ? (
            <form onSubmit={saveProfile} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Blood group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none"
                  >
                    <option value="">— Select —</option>
                    {BLOOD_GROUPS.map((bg) => <option key={bg}>{bg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Height (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="e.g. 170"
                    className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Weight (kg)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 70"
                    className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Medical conditions <span className="font-normal text-gray-400">(comma-separated)</span>
                </label>
                <input
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="e.g. Diabetes, Hypertension"
                  className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Allergies <span className="font-normal text-gray-400">(comma-separated)</span>
                </label>
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Peanuts"
                  className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingProfile ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="rounded-xl bg-gray-50 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : profile ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Blood group</dt>
                <dd className="font-semibold">{profile.blood_group || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Height</dt>
                <dd className="font-semibold">{profile.height_cm ? `${profile.height_cm} cm` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Weight</dt>
                <dd className="font-semibold">{profile.weight_kg ? `${profile.weight_kg} kg` : '—'}</dd>
              </div>
              {profile.height_cm && profile.weight_kg && (
                <div>
                  <dt className="text-xs text-gray-400">BMI</dt>
                  <dd className="font-semibold">
                    {(profile.weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1)}
                  </dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-xs text-gray-400">Conditions</dt>
                <dd className="font-semibold">
                  {profile.medical_conditions.length ? profile.medical_conditions.join(', ') : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-gray-400">Allergies</dt>
                <dd className="font-semibold">
                  {profile.allergies.length ? profile.allergies.join(', ') : '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Loading…</p>
          )}
        </div>

        {/* Family members */}
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Family members</h2>
            <button
              onClick={() => setAddingMember(!addingMember)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Plus size={13} /> Add
            </button>
          </div>

          {addingMember && (
            <form onSubmit={addMember} className="mb-4 grid gap-3 rounded-2xl bg-gray-50 p-4 sm:grid-cols-3">
              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Name *"
                required
                className="rounded-xl bg-white px-4 py-2.5 text-sm outline-none"
              />
              <select
                value={memberRelation}
                onChange={(e) => setMemberRelation(e.target.value)}
                className="rounded-xl bg-white px-4 py-2.5 text-sm outline-none"
              >
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <input
                value={memberPhone}
                onChange={(e) => setMemberPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="rounded-xl bg-white px-4 py-2.5 text-sm outline-none"
              />
              <div className="flex gap-2 sm:col-span-3">
                <button
                  type="submit"
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Add member
                </button>
                <button
                  type="button"
                  onClick={() => setAddingMember(false)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {family.length === 0 ? (
            <div className="py-6 text-center">
              <Users className="mx-auto mb-2 text-gray-200" size={36} />
              <p className="text-sm text-gray-400">No family members added yet.</p>
              <p className="mt-1 text-xs text-gray-400">
                On the Family plan, each member gets their own health records.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {family.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700">
                    {m.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.relation}{m.phone ? ` · ${m.phone}` : ''}</p>
                  </div>
                  <button
                    onClick={() => removeMember(m.id)}
                    className="rounded-lg p-1.5 text-gray-300 hover:bg-white hover:text-red-500"
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Disclaimer */}
        <p className="pb-4 text-center text-xs text-gray-400">
          mydoc.ai does not replace professional medical advice. Always consult a doctor for medical decisions.
        </p>
      </div>
    </div>
  )
}
