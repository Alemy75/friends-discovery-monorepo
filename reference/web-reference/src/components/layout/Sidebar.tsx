import { NavLink } from 'react-router-dom'
import {
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { cn } from '../../lib/utils'
import { useApp } from '../../store/AppStore'
import { Avatar, CoupleAvatar } from '../ui/Avatar'
import { Logo } from '../ui/Logo'

const NAV = [
  { to: '/app/discovery', label: 'Поиск', icon: SparklesIcon },
  { to: '/app/matches', label: 'Мэтчи', icon: ChatBubbleLeftRightIcon },
  { to: '/app/profile', label: 'Профиль', icon: UserIcon },
]

export function Sidebar() {
  const { account, matches } = useApp()
  const displayName =
    account?.kind === 'couple'
      ? account.people.map((p) => p.name.split(' ')[0]).join(' & ')
      : account?.people[0]?.name ?? 'Гость'

  return (
    <aside className="hidden md:flex w-[248px] shrink-0 flex-col bg-surface-alt border-r border-hairline h-screen sticky top-0 px-3 py-5">
      <div className="px-2 mb-6">
        <Logo />
      </div>

      {/* Search trigger — command-palette affordance */}
      <button className="mx-1 mb-4 flex items-center justify-between rounded-pill bg-canvas px-[10px] py-2 text-mid-gray hover:text-ink transition-colors">
        <span className="text-[14px]">Поиск людей…</span>
        <kbd className="text-[11px] border border-hairline rounded-[6px] px-1.5 py-0.5 bg-paper">
          ⌘K
        </kbd>
      </button>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-nested px-3 py-2 text-[14px] font-medium transition-colors',
                isActive
                  ? 'bg-paper text-accent-ink shadow-[var(--shadow-card)]'
                  : 'text-mid-gray hover:text-ink hover:bg-paper/60',
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            <span>{label}</span>
            {to === '/app/matches' && matches.length > 0 && (
              <span className="ml-auto inline-flex items-center rounded-pill bg-ink-soft text-surface-alt px-2 py-0.5 text-[12px] font-medium">
                {matches.length}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-3 rounded-nested px-2 py-2">
          {account?.kind === 'couple' ? (
            <CoupleAvatar people={account.people} size={34} />
          ) : (
            <Avatar name={displayName} size={34} />
          )}
          <div className="min-w-0">
            <div className="text-[14px] font-medium truncate">{displayName}</div>
            <div className="text-[12px] text-mid-gray truncate">
              {account?.kind === 'couple' ? 'Пара' : 'Один'} · {account?.city ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
