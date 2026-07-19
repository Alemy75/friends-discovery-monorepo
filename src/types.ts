export type AccountKind = 'single' | 'couple'

/** What the user is looking for on the platform. */
export type Intent =
  | 'walks'
  | 'double-dates'
  | 'hobby'
  | 'travel'
  | 'deep-talks'
  | 'events'

export interface Person {
  name: string
  age: number
}

export interface Profile {
  id: string
  kind: AccountKind
  /** For a couple this holds both people; for a single, one. */
  people: Person[]
  /** Portrait URL per person (parallel to `people`). Falls back to a monogram. */
  photos: string[]
  city: string
  bio: string
  interests: string[]
  intents: Intent[]
  /** Compatibility score 0–100 (precomputed for the demo). */
  compatibility: number
  /** Whether this profile has already liked the current user. */
  likesYou: boolean
}

/** The signed-in user's own account. */
export interface Account {
  kind: AccountKind
  people: Person[]
  city: string
  bio: string
  interests: string[]
  intents: Intent[]
}

export interface ChatMessage {
  id: string
  /** 'me' for the current user, otherwise the match id. */
  from: 'me' | string
  text: string
  time: string
}

export interface MatchThread {
  profileId: string
  messages: ChatMessage[]
}
