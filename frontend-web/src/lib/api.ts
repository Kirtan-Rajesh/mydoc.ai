/** Minimal fetch-based API client for the web dashboard. */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const V1 = `${API_BASE}/api/v1`

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('mydoc_token')
}

export function setToken(token: string | null) {
  if (token === null) localStorage.removeItem('mydoc_token')
  else localStorage.setItem('mydoc_token', token)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && typeof init.body === 'string')
    headers.set('Content-Type', 'application/json')
  const resp = await fetch(`${V1}${path}`, { ...init, headers })
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`
    try {
      const data = await resp.json()
      if (data.detail) detail = String(data.detail)
    } catch {}
    if (resp.status === 401 && typeof window !== 'undefined') {
      setToken(null)
      window.location.href = '/login'
    }
    throw new Error(detail)
  }
  if (resp.status === 204) return undefined as T
  return (await resp.json()) as T
}

// ---- Auth ----
export const requestOtp = (phone: string) =>
  request<{ message: string; dev_otp: string | null }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })

export const verifyOtp = (phone: string, otp: string, name?: string) =>
  request<{ access_token: string; is_new_user: boolean }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, ...(name ? { name } : {}) }),
  })

// ---- Data types ----
export interface UserOut {
  id: string
  name: string
  phone: string | null
  language_pref: string
}

export interface DocumentOut {
  id: string
  file_name: string
  status: string
  document_type: string | null
  report_date: string | null
  summary: string | null
  created_at: string
}

export interface MedicationOut {
  id: string
  name: string
  dosage: string
  instructions: string
  times: string[]
  is_active: boolean
}

export interface ConversationOut {
  id: string
  title: string
  updated_at: string
}

export interface MessageOut {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ---- Endpoints ----
export const getMe = () => request<UserOut>('/users/me')
export const getDocuments = () => request<DocumentOut[]>('/documents')
export const getDocument = (id: string) =>
  request<DocumentOut & { structured_data: Record<string, unknown> | null }>(
    `/documents/${id}`,
  )
export const deleteDocument = (id: string) =>
  request<void>(`/documents/${id}`, { method: 'DELETE' })
export const getMedications = () => request<MedicationOut[]>('/medications')
export const createMedication = (body: {
  name: string
  dosage: string
  instructions: string
  times: string[]
}) => request<MedicationOut>('/medications', { method: 'POST', body: JSON.stringify(body) })
export const deleteMedication = (id: string) =>
  request<void>(`/medications/${id}`, { method: 'DELETE' })
export const getConversations = () => request<ConversationOut[]>('/chat/conversations')
export const getMessages = (id: string) =>
  request<MessageOut[]>(`/chat/conversations/${id}/messages`)

export async function uploadDocument(file: File): Promise<DocumentOut> {
  const form = new FormData()
  form.append('file', file)
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const resp = await fetch(`${V1}/documents`, { method: 'POST', body: form, headers })
  if (!resp.ok) throw new Error(`Upload failed (${resp.status})`)
  return resp.json()
}

/** Stream a chat reply over SSE; calls onToken per chunk, returns conversation id. */
export async function streamChat(
  message: string,
  opts: {
    conversationId?: string | null
    documentId?: string | null
    onToken: (t: string) => void
  },
): Promise<string | null> {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const resp = await fetch(`${V1}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      ...(opts.conversationId ? { conversation_id: opts.conversationId } : {}),
      ...(opts.documentId ? { document_id: opts.documentId } : {}),
    }),
  })
  if (!resp.ok || !resp.body) throw new Error(`Chat failed (${resp.status})`)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let conversationId: string | null = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'meta') conversationId = event.conversation_id
        if (event.type === 'token' && event.content) opts.onToken(event.content)
      } catch {}
    }
  }
  return conversationId
}
