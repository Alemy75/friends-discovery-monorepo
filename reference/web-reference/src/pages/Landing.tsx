import { Link, useNavigate } from 'react-router-dom'
import {
  UserIcon,
  UsersIcon,
  MapPinIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Logo } from '../components/ui/Logo'
import { useApp } from '../store/AppStore'

const STEPS = [
  {
    icon: UserIcon,
    title: 'Создайте профиль',
    text: 'Один аккаунт или на двоих. Расскажите об интересах и о том, кого ищете.',
  },
  {
    icon: SparklesIcon,
    title: 'Листайте кандидатов',
    text: 'Мы подбираем людей и пары по общим интересам и совместимости.',
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: 'Знакомьтесь вживую',
    text: 'Взаимный интерес открывает чат. Дальше — кофе, прогулка или дабл-дейт.',
  },
]

export function Landing() {
  const navigate = useNavigate()
  const { authed, account } = useApp()
  const go = () => navigate(authed && account ? '/app/discovery' : '/auth')

  return (
    <div className="relative min-h-screen bg-canvas overflow-hidden">
      {/* Warm ambient glow behind the hero */}
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-[560px] -z-10" />

      {/* Nav */}
      <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-hairline">
        <div className="mx-auto max-w-[1280px] px-5 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="md">
                Войти
              </Button>
            </Link>
            <Button size="md" onClick={go}>
              Начать
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1280px] px-5 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="max-w-[760px]">
          <Badge variant="accent" className="mb-6">
            Знакомства для одиночек и пар
          </Badge>
          <h1 className="t-display text-ink">
            Найдите <span className="accent-gradient-text">своих людей</span> — вдвоём или в
            одиночку.
          </h1>
          <p className="t-body-lg text-mid-gray mt-6 max-w-[560px]">
            friends.ai — тихое место, чтобы находить друзей по интересам. Заведите
            личный профиль или общий на пару и знакомьтесь без лишнего шума.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={go}>
              Создать профиль
              <ArrowRightIcon className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Link to="/auth">
              <Button variant="outline" size="lg">
                У меня уже есть аккаунт
              </Button>
            </Link>
          </div>
        </div>

        {/* Account type preview */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 max-w-[720px]">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-nested bg-accent-soft">
                <UserIcon className="h-5 w-5 text-accent-ink" strokeWidth={1.5} />
              </span>
              <div>
                <div className="text-[14px] font-medium">Аккаунт Single</div>
                <div className="text-[12px] text-mid-gray">Для одного человека</div>
              </div>
            </div>
            <p className="t-body text-mid-gray">
              Ищите друзей для прогулок, хобби и разговоров по душам.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-nested bg-accent-soft">
                <UsersIcon className="h-5 w-5 text-accent-ink" strokeWidth={1.5} />
              </span>
              <div>
                <div className="text-[14px] font-medium">Аккаунт для пары</div>
                <div className="text-[12px] text-mid-gray">Один профиль на двоих</div>
              </div>
            </div>
            <p className="t-body text-mid-gray">
              Находите другие пары для дабл-дейтов и совместных поездок.
            </p>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1280px] px-5 pb-24">
        <div className="flex items-end justify-between mb-8">
          <h2 className="t-heading text-ink">Как это работает</h2>
          <span className="hidden sm:flex items-center gap-1 t-caption text-mid-gray">
            <MapPinIcon className="h-4 w-4" strokeWidth={1.5} /> Москва · СПб · Казань
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="p-5">
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-nested bg-accent-soft">
                  <s.icon className="h-5 w-5 text-accent-ink" strokeWidth={1.5} />
                </span>
                <span className="t-caption text-accent-ink">0{i + 1}</span>
              </div>
              <h3 className="t-subheading text-ink">{s.title}</h3>
              <p className="t-body text-mid-gray mt-1">{s.text}</p>
            </Card>
          ))}
        </div>

        {/* CTA band */}
        <div className="accent-gradient mt-8 rounded-card p-8 md:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-white shadow-[0_10px_30px_-12px_rgba(251,93,93,0.6)]">
          <div>
            <h3 className="t-heading-sm">Готовы познакомиться?</h3>
            <p className="t-body text-white/85 mt-1">
              Пара минут на профиль — и можно листать кандидатов.
            </p>
          </div>
          <Button variant="inverse" size="lg" onClick={go} className="shrink-0">
            Начать бесплатно
            <ArrowRightIcon className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-[1280px] px-5 py-8 flex items-center justify-between">
          <Logo />
          <span className="text-[12px] text-mid-gray">
            Демо-интерфейс · данные вымышлены
          </span>
        </div>
      </footer>
    </div>
  )
}
