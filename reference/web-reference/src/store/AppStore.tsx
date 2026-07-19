import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Account, ChatMessage, MatchThread, Profile } from '../types'
import { CANDIDATES, CANNED_REPLIES, seedThread } from '../data/mock'

const STORAGE_KEY = 'friends-ai:v1'

type Decision = 'like' | 'skip'

interface PersistedState {
  authed: boolean
  account: Account | null
  swiped: Record<string, Decision>
  matchIds: string[]
}

interface AppState extends PersistedState {
  candidates: Profile[]
  /** Candidates not yet swiped, in deck order. */
  deck: Profile[]
  matches: Profile[]
  threads: Record<string, MatchThread>
  stats: { matches: number; likes: number; views: number }
}

interface AppContextValue extends AppState {
  login: () => void
  logout: () => void
  completeOnboarding: (account: Account) => void
  updateAccount: (patch: Partial<Account> | ((prev: Account) => Partial<Account>)) => void
  swipe: (id: string, decision: Decision) => { matched: boolean; profile: Profile }
  sendMessage: (profileId: string, text: string) => void
  removeMatch: (profileId: string) => void
  resetDeck: () => void
  reset: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PersistedState
  } catch {
    /* ignore corrupt storage */
  }
  return { authed: false, account: null, swiped: {}, matchIds: [] }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [persisted, setPersisted] = useState<PersistedState>(loadPersisted)
  const [threads, setThreads] = useState<Record<string, MatchThread>>({})

  // Persist the durable slice of state.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } catch {
      /* ignore quota errors */
    }
  }, [persisted])

  // Ensure every match has a seeded chat thread.
  useEffect(() => {
    setThreads((prev) => {
      const next = { ...prev }
      for (const id of persisted.matchIds) {
        if (!next[id]) {
          const profile = CANDIDATES.find((c) => c.id === id)
          if (profile) next[id] = seedThread(profile)
        }
      }
      return next
    })
  }, [persisted.matchIds])

  const login = useCallback(() => {
    setPersisted((s) => ({ ...s, authed: true }))
  }, [])

  const logout = useCallback(() => {
    setPersisted((s) => ({ ...s, authed: false }))
  }, [])

  const completeOnboarding = useCallback((account: Account) => {
    setPersisted((s) => ({ ...s, authed: true, account }))
  }, [])

  const updateAccount = useCallback(
    (patch: Partial<Account> | ((prev: Account) => Partial<Account>)) => {
      setPersisted((s) => {
        if (!s.account) return s
        const resolved = typeof patch === 'function' ? patch(s.account) : patch
        return { ...s, account: { ...s.account, ...resolved } }
      })
    },
    [],
  )

  const swipe = useCallback(
    (id: string, decision: Decision) => {
      const profile = CANDIDATES.find((c) => c.id === id)!
      const matched = decision === 'like' && profile.likesYou
      setPersisted((s) => ({
        ...s,
        swiped: { ...s.swiped, [id]: decision },
        matchIds: matched && !s.matchIds.includes(id) ? [...s.matchIds, id] : s.matchIds,
      }))
      return { matched, profile }
    },
    [],
  )

  const sendMessage = useCallback((profileId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const mine: ChatMessage = { id: `${profileId}-${time}-me`, from: 'me', text: trimmed, time }
    setThreads((prev) => {
      const thread = prev[profileId] ?? { profileId, messages: [] }
      return { ...prev, [profileId]: { ...thread, messages: [...thread.messages, mine] } }
    })
    // Canned auto-reply after a short beat.
    const replyText = CANNED_REPLIES[trimmed.length % CANNED_REPLIES.length]
    window.setTimeout(() => {
      setThreads((prev) => {
        const thread = prev[profileId]
        if (!thread) return prev
        const reply: ChatMessage = {
          id: `${profileId}-${Date.now()}-reply`,
          from: profileId,
          text: replyText,
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        }
        return { ...prev, [profileId]: { ...thread, messages: [...thread.messages, reply] } }
      })
    }, 1100)
  }, [])

  const removeMatch = useCallback((profileId: string) => {
    setPersisted((s) => ({ ...s, matchIds: s.matchIds.filter((id) => id !== profileId) }))
    setThreads((prev) => {
      const next = { ...prev }
      delete next[profileId]
      return next
    })
  }, [])

  const resetDeck = useCallback(() => {
    setPersisted((s) => ({ ...s, swiped: {}, matchIds: [] }))
    setThreads({})
  }, [])

  const reset = useCallback(() => {
    setPersisted({ authed: false, account: null, swiped: {}, matchIds: [] })
    setThreads({})
  }, [])

  const value = useMemo<AppContextValue>(() => {
    const deck = CANDIDATES.filter((c) => !persisted.swiped[c.id])
    const matches = persisted.matchIds
      .map((id) => CANDIDATES.find((c) => c.id === id))
      .filter((p): p is Profile => Boolean(p))
    const likes = Object.values(persisted.swiped).filter((d) => d === 'like').length
    const views = Object.keys(persisted.swiped).length
    return {
      ...persisted,
      candidates: CANDIDATES,
      deck,
      matches,
      threads,
      stats: { matches: matches.length, likes, views },
      login,
      logout,
      completeOnboarding,
      updateAccount,
      swipe,
      sendMessage,
      removeMatch,
      resetDeck,
      reset,
    }
  }, [
    persisted,
    threads,
    login,
    logout,
    completeOnboarding,
    updateAccount,
    swipe,
    sendMessage,
    removeMatch,
    resetDeck,
    reset,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
