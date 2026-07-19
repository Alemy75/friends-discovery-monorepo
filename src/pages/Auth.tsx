import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Field } from '../components/ui/Input'
import { Logo } from '../components/ui/Logo'
import { cn } from '../lib/utils'
import { useApp } from '../store/AppStore'

type Mode = 'login' | 'register'

export function Auth() {
  const navigate = useNavigate()
  const { login, account } = useApp()
  const [mode, setMode] = useState<Mode>('register')
  const [email, setEmail] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    login()
    // Existing account → straight to the app; otherwise onboard.
    navigate(account ? '/app/discovery' : '/onboarding')
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="mx-auto w-full max-w-[1280px] px-5 h-16 flex items-center">
        <Link to="/">
          <Logo />
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-8">
            <h1 className="t-heading text-ink">
              {mode === 'register' ? 'Создайте аккаунт' : 'С возвращением'}
            </h1>
            <p className="t-body text-mid-gray mt-2">
              {mode === 'register'
                ? 'Пара шагов — и можно искать друзей.'
                : 'Войдите, чтобы продолжить знакомства.'}
            </p>
          </div>

          <Card className="p-5">
            {/* Segmented tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-pill bg-canvas p-1 mb-5">
              {(['register', 'login'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-pill py-1.5 text-[14px] font-medium transition-colors',
                    mode === m ? 'bg-paper text-ink shadow-[var(--shadow-card)]' : 'text-mid-gray',
                  )}
                >
                  {m === 'register' ? 'Регистрация' : 'Вход'}
                </button>
              ))}
            </div>

            <form className="flex flex-col gap-4" onSubmit={submit}>
              <Field label="Email">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Пароль">
                <Input type="password" required placeholder="••••••••" defaultValue="demo1234" />
              </Field>

              <Button type="submit" size="lg" className="mt-1 w-full">
                {mode === 'register' ? 'Продолжить' : 'Войти'}
              </Button>
            </form>

            <p className="text-[12px] text-mid-gray text-center mt-4">
              Это демо — любые данные подойдут, ничего не отправляется.
            </p>
          </Card>

          <p className="text-center text-[14px] text-mid-gray mt-5">
            {mode === 'register' ? 'Уже есть аккаунт?' : 'Впервые здесь?'}{' '}
            <button
              className="text-ink font-medium underline underline-offset-2"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            >
              {mode === 'register' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
