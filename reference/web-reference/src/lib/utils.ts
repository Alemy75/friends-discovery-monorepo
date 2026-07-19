/** Tiny classnames joiner — filters falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Deterministic warm-coral gradient for an avatar, derived from a seed string. */
export function gradientFromSeed(seed: string): string {
  const hash = hashSeed(seed)
  // Warm arc: pink → coral → amber (hue 335°..405° wrapped to 0..360).
  const h1 = (335 + (hash % 70)) % 360
  const h2 = (h1 + 26) % 360
  return `linear-gradient(135deg, hsl(${h1} 85% 66%), hsl(${h2} 90% 60%))`
}

/** Initials from a name ("Анна Соколова" → "АС"). */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
