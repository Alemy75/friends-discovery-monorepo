import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { AppLayout } from './components/layout/AppLayout'
import { useApp } from './store/AppStore'
import { Landing } from './pages/Landing'
import { Auth } from './pages/Auth'
import { Onboarding } from './pages/Onboarding'
import { Discovery } from './pages/Discovery'
import { Matches } from './pages/Matches'
import { Profile } from './pages/Profile'
import type { ReactNode } from 'react'

/** Requires a completed account; otherwise routes back to auth/onboarding. */
function RequireAccount({ children }: { children: ReactNode }) {
  const { authed, account } = useApp()
  if (!authed) return <Navigate to="/auth" replace />
  if (!account) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route
          path="/app"
          element={
            <RequireAccount>
              <AppLayout />
            </RequireAccount>
          }
        >
          <Route index element={<Navigate to="discovery" replace />} />
          <Route path="discovery" element={<Discovery />} />
          <Route path="matches" element={<Matches />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
