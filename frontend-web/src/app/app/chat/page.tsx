'use client'

import { useEffect, useRef, useState } from 'react'
import { History, Paperclip, Send, Sparkles } from 'lucide-react'
import {
  getConversations,
  getMessages,
  streamChat,
  uploadDocument,
  type ConversationOut,
} from '@/lib/api'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const suggestions = [
  'Explain my latest report',
  'What should I eat for low hemoglobin?',
  'What is this medicine for?',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [history, setHistory] = useState<ConversationOut[] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string, documentId?: string) {
    if (!text.trim() || busy) return
    setInput('')
    setBusy(true)
    setMessages((m) => [
      ...m,
      { role: 'user', content: text.trim() },
      { role: 'assistant', content: '', streaming: true },
    ])
    try {
      const convId = await streamChat(text.trim(), {
        conversationId,
        documentId,
        onToken: (t) =>
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: copy[copy.length - 1].content + t,
            }
            return copy
          }),
      })
      if (convId) setConversationId(convId)
    } catch (err) {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Something went wrong.',
        }
        return copy
      })
    } finally {
      setMessages((m) =>
        m.map((msg) => ({ ...msg, streaming: false })),
      )
      setBusy(false)
    }
  }

  async function attach(file: File) {
    setBusy(true)
    try {
      const doc = await uploadDocument(file)
      setMessages((m) => [...m, { role: 'user', content: `📎 Attached: ${doc.file_name}` }])
      setBusy(false)
      await send(`I just attached "${doc.file_name}" — please analyse it for me.`, doc.id)
    } catch (err) {
      setBusy(false)
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: err instanceof Error ? err.message : 'Upload failed.' },
      ])
    }
  }

  async function openConversation(c: ConversationOut) {
    const msgs = await getMessages(c.id)
    setConversationId(c.id)
    setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    setHistory(null)
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Topbar */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6">
        <h1 className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-brand-500 text-white">
            <Sparkles size={15} />
          </span>
          MyDoc AI
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => setHistory(history ? null : await getConversations())}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <History size={16} /> History
          </button>
          <button
            onClick={() => {
              setMessages([])
              setConversationId(null)
            }}
            className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
          >
            New chat
          </button>
        </div>
      </div>

      {history && (
        <div className="border-b border-gray-100 bg-white px-6 py-3">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No past conversations.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {history.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openConversation(c)}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="pt-16 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-brand-500 text-white">
                <Sparkles size={26} />
              </div>
              <h2 className="text-2xl font-extrabold">How can I help you today?</h2>
              <p className="mt-2 text-sm text-gray-500">
                I know your reports, medicines and health profile.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:border-brand-500 hover:text-brand-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-5 py-3 text-sm text-white'
                    : 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-5 py-3 text-sm leading-relaxed shadow-soft'
                }
              >
                {m.streaming && !m.content ? (
                  <span className="animate-pulse text-gray-400">Thinking…</span>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-white px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="mx-auto flex max-w-3xl items-end gap-3"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) attach(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            title="Attach a report"
          >
            <Paperclip size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your doctor…"
            className="h-12 flex-1 rounded-2xl bg-gray-50 px-5 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <button
            disabled={busy || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-gray-400">
          MyDoc AI informs and coaches — it never replaces your doctor.
        </p>
      </div>
    </div>
  )
}
