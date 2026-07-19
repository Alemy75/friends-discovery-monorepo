import { useState } from 'react'
import { cn, gradientFromSeed, initials } from '../../lib/utils'

interface ProfileImageProps {
  src?: string
  /** Seed for the fallback monogram (usually the person's name). */
  seed: string
  className?: string
  /** Font size for the fallback initials. */
  fallbackSize?: number
}

/** Fills its container with a portrait; falls back to a gradient monogram on error. */
export function ProfileImage({ src, seed, className, fallbackSize = 40 }: ProfileImageProps) {
  const [failed, setFailed] = useState(false)

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('h-full w-full object-cover', className)}
      />
    )
  }

  return (
    <div
      className={cn('h-full w-full flex items-center justify-center text-white font-semibold', className)}
      style={{ backgroundImage: gradientFromSeed(seed), fontSize: fallbackSize }}
      aria-hidden
    >
      {initials(seed)}
    </div>
  )
}
