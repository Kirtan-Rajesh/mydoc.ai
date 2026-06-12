'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import {
  deleteDocument,
  getDocument,
  getDocuments,
  uploadDocument,
  type DocumentOut,
} from '@/lib/api'

type Detail = DocumentOut & { structured_data: Record<string, unknown> | null }

export default function RecordsPage() {
  const [docs, setDocs] = useState<DocumentOut[] | null>(null)
  const [selected, setSelected] = useState<Detail | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    getDocuments().then(setDocs).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Poll while anything is processing.
  useEffect(() => {
    if (!docs?.some((d) => d.status === 'uploaded' || d.status === 'processing')) return
    const t = setTimeout(refresh, 4000)
    return () => clearTimeout(t)
  }, [docs, refresh])

  async function onUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      await uploadDocument(file)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6">
        <h1 className="font-bold">Health Records</h1>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Uploading…' : 'Upload report'}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <div>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {!docs ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : docs.length === 0 ? (
            <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
              <FileText className="mx-auto mb-4 text-gray-300" size={48} />
              <h2 className="font-bold">Your vault is empty</h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload a lab report or prescription — the AI will read and classify it.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => getDocument(d.id).then(setSelected)}
                    className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-soft hover:ring-2 hover:ring-brand-100"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      {d.status === 'uploaded' || d.status === 'processing' ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <FileText size={18} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{d.file_name}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {d.status === 'ready'
                          ? d.summary ?? d.document_type ?? 'Ready'
                          : d.status === 'failed'
                            ? 'Processing failed'
                            : 'Analysing…'}
                      </span>
                    </span>
                    {d.report_date && (
                      <span className="shrink-0 text-xs text-gray-400">{d.report_date}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail panel */}
        <aside>
          {selected ? (
            <div className="sticky top-6 rounded-3xl bg-white p-6 shadow-soft">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="font-bold leading-snug">{selected.file_name}</h2>
                <button
                  onClick={async () => {
                    await deleteDocument(selected.id)
                    setSelected(null)
                    refresh()
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                {selected.document_type && (
                  <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
                    {selected.document_type.replace('_', ' ')}
                  </span>
                )}
                {selected.report_date && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                    {selected.report_date}
                  </span>
                )}
              </div>
              {selected.summary && (
                <p className="text-sm leading-relaxed text-gray-700">{selected.summary}</p>
              )}
              {selected.structured_data &&
                Object.keys(selected.structured_data).length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
                    {Object.entries(selected.structured_data).map(([k, v], i) => (
                      <div
                        key={k}
                        className={
                          'flex items-center justify-between px-4 py-2.5 text-sm' +
                          (i % 2 ? ' bg-gray-50' : '')
                        }
                      >
                        <span className="text-gray-600">{k}</span>
                        <span className="font-bold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            <div className="sticky top-6 rounded-3xl border-2 border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
              Select a record to see the AI summary and key values.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
