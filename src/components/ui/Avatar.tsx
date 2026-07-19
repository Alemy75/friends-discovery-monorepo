import { useState } from 'react'
import { cn, initials, gradientFromSeed } from '../../lib/utils'
import type { Person } from '../../types'

interface AvatarProps {
  name: string
  src?: string
  size?: number
  className?: string
}

/** Circular avatar — portrait photo when available, else a gradient monogram. */
export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full overflow-hidden font-semibold text-white select-none shrink-0',
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: showImage ? undefined : gradientFromSeed(name),
        fontSize: Math.round(size * 0.36),
      }}
      aria-hidden
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}

/** Overlapping pair of avatars for couple profiles. */
export function CoupleAvatar({
  people,
  srcs = [],
  size = 40,
  className,
}: {
  people: Person[]
  srcs?: string[]
  size?: number
  className?: string
}) {
  if (people.length < 2) {
    return <Avatar name={people[0]?.name ?? ''} src={srcs[0]} size={size} className={className} />
  }
  return (
    <span className={cn('inline-flex items-center', className)} style={{ height: size }}>
      <Avatar name={people[0].name} src={srcs[0]} size={size} className="ring-2 ring-paper" />
      <Avatar name={people[1].name} src={srcs[1]} size={size} className="-ml-3 ring-2 ring-paper" />
    </span>
  )
}
