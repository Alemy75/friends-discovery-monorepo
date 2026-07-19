import { NavLink, Outlet } from 'react-router-dom'
import {
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { Sidebar } from './Sidebar'
import { Logo } from '../ui/Logo'
import { cn } from '../../lib/utils'

const MOBILE_NAV = [
  { to: '/app/discovery', label: 'Поиск', icon: SparklesIcon },
  { to: '/app/matches', label: 'Мэтчи', icon: ChatBubbleLeftRightIcon },
  { to: '/app/profile', label: 'Профиль', icon: UserIcon },
]

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-surface-alt/90 backdrop-blur border-b border-hairline px-4 h-14">
          <Logo />
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden sticky bottom-0 z-30 grid grid-cols-3 bg-surface-alt/95 backdrop-blur border-t border-hairline">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[12px] font-medium transition-colors',
                  isActive ? 'text-accent-ink' : 'text-mid-gray',
                )
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
