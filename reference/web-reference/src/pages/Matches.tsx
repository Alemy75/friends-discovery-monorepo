import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PaperAirplaneIcon,
  ArrowLeftIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Avatar, CoupleAvatar } from '../components/ui/Avatar'
import { cn } from '../lib/utils'
import { useApp } from '../store/AppStore'
import { useToast } from '../components/ui/Toast'
import type { Profile } from '../types'

function displayName(p: Profile) {
  return p.kind === 'couple'
    ? p.people.map((x) => x.name.split(' ')[0]).join(' & ')
    : p.people[0].name
}

export function Matches() {
  const { matches, threads, sendMessage, removeMatch } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedId) ?? null,
    [matches, selectedId],
  )
  const thread = selectedId ? threads[selectedId] : undefined

  // Auto-select the first match on desktop.
  useEffect(() => {
    if (!selectedId && matches.length && window.matchMedia('(min-width: 768px)').matches) {
      setSelectedId(matches[0].id)
    }
  }, [matches, selectedId])

  // Drop selection if the match disappears.
  useEffect(() => {
    if (selectedId && !matches.some((m) => m.id === selectedId)) setSelectedId(null)
    setConfirmRemove(false)
  }, [matches, selectedId])

  // Keep the chat scrolled to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread?.messages.length, selectedId])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !draft.trim()) return
    sendMessage(selectedId, draft)
    setDraft('')
  }

  if (matches.length === 0) {
    return (
      <div className="mx-auto max-w-[1280px] px-5 py-10">
        <h1 className="t-heading-sm text-ink mb-6">Мэтчи</h1>
        <Card className="p-10 flex flex-col items-center justify-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-nested bg-canvas mb-4">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-ink" strokeWidth={1.5} />
          </span>
          <h3 className="t-subheading text-ink">Пока нет мэтчей</h3>
          <p className="t-body text-mid-gray mt-1 max-w-[320px]">
            Отмечайте «Интересно» в поиске. Когда интерес взаимен — здесь появится чат.
          </p>
          <Button className="mt-5" onClick={() => navigate('/app/discovery')}>
            Перейти к поиску
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-6 md:py-10">
      <h1 className="t-heading-sm text-ink mb-6">Мэтчи</h1>

      <Card className="overflow-hidden p-0">
        <div className="flex h-[600px]">
          {/* List */}
          <div
            className={cn(
              'w-full md:w-[300px] md:border-r border-hairline flex-col bg-surface-alt',
              selected ? 'hidden md:flex' : 'flex',
            )}
          >
            <div className="px-4 py-3 border-b border-hairline">
              <span className="t-caption text-mid-gray">{matches.length} совпадений</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {matches.map((m) => {
                const msgs = threads[m.id]?.messages
                const last = msgs?.[msgs.length - 1]
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      'w-full text-left flex items-center gap-3 px-4 py-3 border-b border-hairline transition-colors',
                      selectedId === m.id ? 'bg-paper' : 'hover:bg-paper/60',
                    )}
                  >
                    {m.kind === 'couple' ? (
                      <CoupleAvatar people={m.people} srcs={m.photos} size={40} />
                    ) : (
                      <Avatar name={m.people[0].name} src={m.photos[0]} size={40} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-medium truncate">{displayName(m)}</span>
                        {last && (
                          <span className="text-[11px] text-mid-gray shrink-0">{last.time}</span>
                        )}
                      </div>
                      <p className="text-[13px] text-mid-gray truncate">
                        {last?.text ?? 'Скажите привет 👋'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chat */}
          <div className={cn('flex-1 flex-col min-w-0', selected ? 'flex' : 'hidden md:flex')}>
            {selected ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
                  <button
                    className="md:hidden text-mid-gray hover:text-ink"
                    onClick={() => setSelectedId(null)}
                    aria-label="Назад"
                  >
                    <ArrowLeftIcon className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                  {selected.kind === 'couple' ? (
                    <CoupleAvatar people={selected.people} srcs={selected.photos} size={38} />
                  ) : (
                    <Avatar name={selected.people[0].name} src={selected.photos[0]} size={38} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium truncate">{displayName(selected)}</div>
                    <div className="flex items-center gap-1 text-[12px] text-mid-gray">
                      <MapPinIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {selected.city}
                    </div>
                  </div>
                  <Badge variant="accent">{selected.compatibility}% совпадение</Badge>
                  <button
                    className="text-mid-gray hover:text-ember transition-colors p-1"
                    onClick={() => setConfirmRemove(true)}
                    aria-label="Удалить мэтч"
                  >
                    <TrashIcon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Destructive confirm */}
                {confirmRemove && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-canvas border-b border-hairline">
                    <span className="text-[13px] text-ink">Удалить мэтч и переписку?</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                        Отмена
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          removeMatch(selected.id)
                          toast({ title: 'Мэтч удалён' })
                        }}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                  {thread?.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'max-w-[78%] rounded-[14px] px-3 py-2 text-[14px]',
                        msg.from === 'me'
                          ? 'self-end bg-ink text-surface-alt'
                          : 'self-start bg-canvas text-ink',
                      )}
                    >
                      {msg.text}
                      <span
                        className={cn(
                          'block text-[10px] mt-1',
                          msg.from === 'me' ? 'text-surface-alt/60' : 'text-mid-gray',
                        )}
                      >
                        {msg.time}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Composer */}
                <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-hairline">
                  <Input
                    placeholder="Напишите сообщение…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <Button
                    type="submit"
                    className="h-9 w-9 !px-0 rounded-full shrink-0"
                    disabled={!draft.trim()}
                    aria-label="Отправить"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-mid-gray text-[14px]">
                Выберите чат слева
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
