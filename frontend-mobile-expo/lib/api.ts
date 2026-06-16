import * as SecureStore from 'expo-secure-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  phone: string;
  language_pref: string;
}

export interface HealthProfile {
  user_id: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  medical_conditions: string[];
  allergies: string[];
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  date_of_birth: string | null;
  gender: string | null;
}

export interface DocumentModel {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  document_type: string | null;
  lab_name: string | null;
  report_date: string | null;
  summary: string | null;
  member_id: string | null;
  created_at: string;
  // only present on detail endpoint
  structured_data?: Record<string, unknown> | null;
  raw_text?: string | null;
  error?: string | null;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  times: string[];
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  member_id: string | null;
}

export interface TodayDose {
  medication_id: string;
  medication_name: string;
  dosage: string;
  time: string;
  scheduled_for: string;
  status: 'pending' | 'taken' | 'skipped';
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: string[] | null;
  created_at: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── Base fetch ───────────────────────────────────────────────────────────────

const BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(
    /\/$/,
    '',
  );

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (
    fetchOptions.body &&
    typeof fetchOptions.body === 'string' &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail ?? data.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  return response;
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export async function requestOtp(phone: string): Promise<{ message: string; dev_otp?: string }> {
  const res = await apiFetch('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
    skipAuth: true,
  });
  return res.json();
}

export async function verifyOtp(
  phone: string,
  otp: string,
  name?: string,
): Promise<{ access_token: string; token_type: string; is_new_user: boolean }> {
  const body: Record<string, string> = { phone, otp };
  if (name) body.name = name;
  const res = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
  return res.json();
}

// ─── User endpoints ───────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  const res = await apiFetch('/users/me');
  return res.json();
}

export async function updateMe(data: Partial<Pick<User, 'name' | 'language_pref'>>): Promise<User> {
  const res = await apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getHealthProfile(): Promise<HealthProfile> {
  const res = await apiFetch('/users/me/profile');
  return res.json();
}

export async function updateHealthProfile(data: Partial<HealthProfile>): Promise<HealthProfile> {
  const res = await apiFetch('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Family endpoints ─────────────────────────────────────────────────────────

export async function getFamily(): Promise<FamilyMember[]> {
  const res = await apiFetch('/users/me/family');
  return res.json();
}

export async function addFamilyMember(data: {
  name: string;
  relation: string;
  date_of_birth?: string;
  gender?: string;
}): Promise<FamilyMember> {
  const res = await apiFetch('/users/me/family', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteFamilyMember(id: string): Promise<void> {
  await apiFetch(`/users/me/family/${id}`, { method: 'DELETE' });
}

// ─── Documents endpoints ──────────────────────────────────────────────────────

export async function getDocuments(): Promise<DocumentModel[]> {
  const res = await apiFetch('/documents');
  return res.json();
}

export async function getDocument(id: string): Promise<DocumentModel> {
  const res = await apiFetch(`/documents/${id}`);
  return res.json();
}

export async function uploadDocument(
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<DocumentModel> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/documents`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.detail ?? data.message ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch(`/documents/${id}`, { method: 'DELETE' });
}

// ─── Medications endpoints ────────────────────────────────────────────────────

export async function getMedications(): Promise<Medication[]> {
  const res = await apiFetch('/medications');
  return res.json();
}

export async function createMedication(data: {
  name: string;
  dosage: string;
  instructions: string;
  times: string[];
}): Promise<Medication> {
  const res = await apiFetch('/medications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteMedication(id: string): Promise<void> {
  await apiFetch(`/medications/${id}`, { method: 'DELETE' });
}

export async function getTodayDoses(): Promise<TodayDose[]> {
  const res = await apiFetch('/medications/today');
  return res.json();
}

export async function logDose(
  medicationId: string,
  scheduledFor: string,
  status: 'taken' | 'skipped',
): Promise<void> {
  await apiFetch(`/medications/${medicationId}/logs`, {
    method: 'POST',
    body: JSON.stringify({ scheduled_for: scheduledFor, status }),
  });
}

// ─── Chat endpoints ───────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  const res = await apiFetch('/chat/conversations');
  return res.json();
}

export async function streamChat(
  message: string,
  conversationId?: string,
  documentId?: string,
): Promise<ReadableStream<Uint8Array>> {
  const body: Record<string, string> = { message };
  if (conversationId) body.conversation_id = conversationId;
  if (documentId) body.document_id = documentId;

  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message2 = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message2 = data.detail ?? data.message ?? message2;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message2);
  }

  if (!res.body) {
    throw new Error('No response body for SSE stream');
  }

  return res.body;
}
