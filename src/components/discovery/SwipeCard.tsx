import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { MapPinIcon, HeartIcon } from '@heroicons/react/24/outline'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { CompatRing } from '../ui/CompatRing'
import { ProfileImage } from '../ui/ProfileImage'
import type { Profile } from '../../types'

type Decision = 'like' | 'skip'
const THRESHOLD = 110

export interface SwipeHandle {
  like: () => void
  skip: () => void
}

export const SwipeCard = forwardRef<
  SwipeHandle,
  { profile: Profile; onDecided: (d: Decision) => void }
>(function SwipeCard({ profile, onDecided }, ref) {
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exit, setExit] = useState<Decision | null>(null)
  const start = useRef({ x: 0, y: 0 })

  const decide = (d: Decision) => setExit((prev) => prev ?? d)
  useImperativeHandle(ref, () => ({ like: () => decide('like'), skip: () => decide('skip') }))

  const isCouple = profile.kind === 'couple'
  const title = isCouple
    ? profile.people.map((p) => p.name.split(' ')[0]).join(' & ')
    : `${profile.people[0].name}, ${profile.people[0].age}`
  const subline = isCouple
    ? `Пара · ${profile.people.map((p) => p.age).join(' и ')}`
    : 'Один'

  const onDown = (e: PointerEvent) => {
    if (exit) return
    setDragging(true)
    start.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging) return
    setDx(e.clientX - start.current.x)
    setDy((e.clientY - start.current.y) * 0.4)
  }
  const onUp = () => {
    if (!dragging) return
    setDragging(false)
    if (dx > THRESHOLD) setExit('like')
    else if (dx < -THRESHOLD) setExit('skip')
    else {
      setDx(0)
      setDy(0)
    }
  }

  const x = exit === 'like' ? 700 : exit === 'skip' ? -700 : dx
  const rot = Math.max(-14, Math.min(14, x / 18))
  const likeOpacity = Math.max(0, Math.min(1, dx / THRESHOLD))
  const skipOpacity = Math.max(0, Math.min(1, -dx / THRESHOLD))

  return (
    <div
      className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
      style={{
        transform: `translate(${x}px, ${dy}px) rotate(${rot}deg)`,
        transition: dragging ? 'none' : 'transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 320ms',
        opacity: exit ? 0 : 1,
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onTransitionEnd={() => exit && onDecided(exit)}
    >
      <Card className="h-full flex flex-col overflow-hidden">
        {/* Photo header */}
        <div className="relative flex-[1.55] min-h-0">
          {isCouple ? (
            <div className="grid grid-cols-2 h-full gap-[2px] bg-paper">
              <div className="overflow-hidden">
                <ProfileImage
                  src={profile.photos[0]}
                  seed={profile.people[0].name}
                  fallbackSize={44}
                />
              </div>
              <div className="overflow-hidden">
                <ProfileImage
                  src={profile.photos[1]}
                  seed={profile.people[1].name}
                  fallbackSize={44}
                />
              </div>
            </div>
          ) : (
            <ProfileImage src={profile.photos[0]} seed={profile.people[0].name} fallbackSize={56} />
          )}

          {/* Top overlays */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <Badge variant="soft">{isCouple ? 'Пара' : 'Single'}</Badge>
            <span className="inline-flex items-center justify-center rounded-full bg-paper/85 backdrop-blur p-0.5 shadow-[var(--shadow-card)]">
              <CompatRing value={profile.compatibility} />
            </span>
          </div>

          {/* Decision stamps (drag feedback) */}
          <span
            className="pointer-events-none absolute left-4 top-16 z-10 rounded-pill border-2 border-white bg-accent/85 px-3 py-1 text-[15px] font-semibold text-white -rotate-12"
            style={{ opacity: likeOpacity }}
          >
            ИНТЕРЕСНО
          </span>
          <span
            className="pointer-events-none absolute right-4 top-16 z-10 rounded-pill border-2 border-white bg-ink/70 px-3 py-1 text-[15px] font-semibold text-white rotate-12"
            style={{ opacity: skipOpacity }}
          >
            ПРОПУСК
          </span>

          {/* Bottom scrim + identity */}
          <div className="absolute inset-x-0 bottom-0 p-4 pt-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent">
            <h3 className="text-white text-[24px] leading-tight font-semibold tracking-[-0.02em]">
              {title}
            </h3>
            <div className="flex items-center gap-1.5 text-white/85 mt-0.5">
              <span className="text-[13px]">{subline}</span>
              <span>·</span>
              <MapPinIcon className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-[13px]">{profile.city}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-h-0 p-5 flex flex-col gap-3">
          {profile.likesYou && (
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-accent-ink">
              <HeartIcon className="h-3.5 w-3.5" strokeWidth={2} />
              Уже проявил{isCouple ? 'и' : '(а)'} интерес к вам
            </div>
          )}
          <p className="t-body text-mid-gray line-clamp-3">{profile.bio}</p>
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {profile.interests.map((i) => (
              <Badge key={i} variant="outline">
                {i}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
})
