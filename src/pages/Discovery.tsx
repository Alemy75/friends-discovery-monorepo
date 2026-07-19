import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  XMarkIcon,
  HeartIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ProfileImage } from '../components/ui/ProfileImage'
import { SwipeCard, type SwipeHandle } from '../components/discovery/SwipeCard'
import { useApp } from '../store/AppStore'
import { useToast } from '../components/ui/Toast'
import type { Profile } from '../types'

/** Static depth layer peeking behind the active card. */
function GhostCard({ profile, depth }: { profile: Profile; depth: number }) {
  const isCouple = profile.kind === 'couple'
  return (
    <div
      className="absolute inset-0"
      style={{
        transform: `scale(${1 - depth * 0.04}) translateY(${depth * 14}px)`,
        opacity: 1 - depth * 0.35,
        zIndex: -depth,
      }}
    >
      <Card className="h-full overflow-hidden">
        {isCouple ? (
          <div className="grid grid-cols-2 h-full gap-[2px] bg-paper">
            <div className="overflow-hidden">
              <ProfileImage src={profile.photos[0]} seed={profile.people[0].name} />
            </div>
            <div className="overflow-hidden">
              <ProfileImage src={profile.photos[1]} seed={profile.people[1].name} />
            </div>
          </div>
        ) : (
          <ProfileImage src={profile.photos[0]} seed={profile.people[0].name} />
        )}
      </Card>
    </div>
  )
}

export function Discovery() {
  const { deck, swipe, resetDeck } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const swipeRef = useRef<SwipeHandle>(null)

  const top = deck[0]

  const handleDecided = (d: 'like' | 'skip') => {
    if (!top) return
    const { matched, profile } = swipe(top.id, d)
    if (matched) {
      const who =
        profile.kind === 'couple'
          ? profile.people.map((p) => p.name.split(' ')[0]).join(' & ')
          : profile.people[0].name.split(' ')[0]
      toast({ title: 'Это мэтч! 🎉', description: `${who} тоже хочет познакомиться` })
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-6 md:py-10">
      <div className="mx-auto max-w-[420px]">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="t-heading-sm text-ink">Поиск</h1>
            <p className="text-[14px] text-mid-gray">Листайте, чтобы найти своих людей</p>
          </div>
          {deck.length > 0 && (
            <Badge variant="soft">{deck.length} в колоде</Badge>
          )}
        </div>

        {/* Card stack */}
        <div className="relative w-full h-[560px]">
          {deck.length === 0 ? (
            <Card className="h-full flex flex-col items-center justify-center text-center p-8">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-nested bg-canvas mb-4">
                <SparklesIcon className="h-6 w-6 text-ink" strokeWidth={1.5} />
              </span>
              <h3 className="t-subheading text-ink">Вы посмотрели всех</h3>
              <p className="t-body text-mid-gray mt-1 max-w-[280px]">
                Новые люди появляются каждый день. Загляните в мэтчи или начните колоду заново.
              </p>
              <div className="flex gap-2 mt-5">
                <Button variant="outline" onClick={() => navigate('/app/matches')}>
                  К мэтчам
                </Button>
                <Button onClick={resetDeck}>
                  <ArrowPathIcon className="h-4 w-4" strokeWidth={1.75} />
                  Заново
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {deck[2] && <GhostCard profile={deck[2]} depth={2} />}
              {deck[1] && <GhostCard profile={deck[1]} depth={1} />}
              <SwipeCard key={top.id} ref={swipeRef} profile={top} onDecided={handleDecided} />
            </>
          )}
        </div>

        {/* Actions */}
        {deck.length > 0 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              className="h-12 w-12 !px-0 rounded-full"
              onClick={() => swipeRef.current?.skip()}
              aria-label="Пропустить"
            >
              <XMarkIcon className="h-5 w-5" strokeWidth={1.75} />
            </Button>
            <Button
              className="h-12 px-6 rounded-full"
              onClick={() => swipeRef.current?.like()}
              aria-label="Интересно"
            >
              <HeartIcon className="h-5 w-5" strokeWidth={1.75} />
              Интересно
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
