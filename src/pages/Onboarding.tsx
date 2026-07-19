import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserIcon,
  UsersIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Textarea, Field } from '../components/ui/Input'
import { Chip } from '../components/ui/Chip'
import { Logo } from '../components/ui/Logo'
import { cn } from '../lib/utils'
import { useApp } from '../store/AppStore'
import type { AccountKind, Intent, Person } from '../types'
import { ALL_INTENTS, INTENT_LABELS, INTEREST_OPTIONS } from '../data/constants'

const STEPS = ['Тип', 'О вас', 'Интересы', 'Финал']

export function Onboarding() {
  const navigate = useNavigate()
  const { completeOnboarding } = useApp()

  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<AccountKind>('single')
  const [people, setPeople] = useState<Person[]>([
    { name: '', age: 27 },
    { name: '', age: 27 },
  ])
  const [city, setCity] = useState('Москва')
  const [interests, setInterests] = useState<string[]>([])
  const [intents, setIntents] = useState<Intent[]>([])
  const [bio, setBio] = useState('')

  const activePeople = kind === 'couple' ? people : people.slice(0, 1)

  const setPerson = (i: number, patch: Partial<Person>) =>
    setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))

  // Functional updater so rapid toggles never read a stale list.
  const toggleFrom =
    <T,>(value: T) =>
    (prev: T[]): T[] =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]

  const canNext = useMemo(() => {
    if (step === 1) return activePeople.every((p) => p.name.trim().length > 0) && city.trim()
    if (step === 2) return interests.length >= 2 && intents.length >= 1
    return true
  }, [step, activePeople, city, interests, intents])

  const finish = () => {
    completeOnboarding({
      kind,
      people: activePeople.map((p) => ({ name: p.name.trim(), age: p.age })),
      city: city.trim(),
      bio: bio.trim() || 'Пока без описания — но с удовольствием познакомлюсь!',
      interests,
      intents,
    })
    navigate('/app/discovery')
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="mx-auto w-full max-w-[1280px] px-5 h-16 flex items-center">
        <Logo />
      </header>

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-8">
        <div className="w-full max-w-[560px]">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="t-caption text-mid-gray">
                Шаг {step + 1} из {STEPS.length}
              </span>
              <span className="text-[13px] text-ink font-medium">{STEPS[step]}</span>
            </div>
            <div className="h-1 rounded-pill bg-hairline overflow-hidden">
              <div
                className="h-full accent-gradient transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <Card className="p-6">
            {/* Step 0 — account kind */}
            {step === 0 && (
              <div>
                <h2 className="t-heading-sm text-ink">Какой у вас аккаунт?</h2>
                <p className="t-body text-mid-gray mt-1 mb-5">
                  Это можно будет изменить позже.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { k: 'single', icon: UserIcon, title: 'Single', desc: 'Один человек, ищу друзей' },
                      { k: 'couple', icon: UsersIcon, title: 'Пара', desc: 'Профиль на двоих' },
                    ] as const
                  ).map(({ k, icon: Icon, title, desc }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        'text-left rounded-nested p-4 border transition-colors',
                        kind === k
                          ? 'border-accent bg-accent-soft'
                          : 'border-hairline hover:border-mid-gray',
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-nested bg-paper border border-hairline">
                          <Icon className="h-5 w-5 text-ink" strokeWidth={1.5} />
                        </span>
                        {kind === k && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full accent-gradient text-white">
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                        )}
                      </div>
                      <div className="text-[15px] font-medium text-ink">{title}</div>
                      <div className="text-[13px] text-mid-gray">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1 — about you */}
            {step === 1 && (
              <div>
                <h2 className="t-heading-sm text-ink">
                  {kind === 'couple' ? 'Расскажите о вас двоих' : 'Расскажите о себе'}
                </h2>
                <p className="t-body text-mid-gray mt-1 mb-5">Имя и возраст видны другим.</p>

                <div className="flex flex-col gap-4">
                  {activePeople.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_96px] gap-3">
                      <Field label={kind === 'couple' ? `Имя #${i + 1}` : 'Имя'}>
                        <Input
                          placeholder="Как вас зовут"
                          value={p.name}
                          onChange={(e) => setPerson(i, { name: e.target.value })}
                        />
                      </Field>
                      <Field label="Возраст">
                        <Input
                          type="number"
                          min={18}
                          max={99}
                          value={p.age}
                          onChange={(e) => setPerson(i, { age: Number(e.target.value) })}
                        />
                      </Field>
                    </div>
                  ))}
                  <Field label="Город">
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            {/* Step 2 — interests & intents */}
            {step === 2 && (
              <div>
                <h2 className="t-heading-sm text-ink">Что вам интересно?</h2>
                <p className="t-body text-mid-gray mt-1 mb-4">
                  Выберите минимум 2 интереса и хотя бы одну цель.
                </p>

                <div className="mb-5">
                  <div className="t-caption text-mid-gray mb-2">Интересы</div>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((opt) => (
                      <Chip
                        key={opt}
                        selected={interests.includes(opt)}
                        onClick={() => setInterests(toggleFrom(opt))}
                      >
                        {opt}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="t-caption text-mid-gray mb-2">Кого ищете</div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_INTENTS.map((it) => (
                      <Chip
                        key={it}
                        selected={intents.includes(it)}
                        onClick={() => setIntents(toggleFrom(it))}
                      >
                        {INTENT_LABELS[it]}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — bio */}
            {step === 3 && (
              <div>
                <h2 className="t-heading-sm text-ink">Пара слов о себе</h2>
                <p className="t-body text-mid-gray mt-1 mb-5">
                  Необязательно, но помогает завязать разговор.
                </p>
                <Field label="О себе">
                  <Textarea
                    rows={4}
                    placeholder="Например: любим готовить по выходным и ищем компанию для настолок…"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </Card>

          {/* Nav */}
          <div className="flex items-center justify-between mt-5">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeftIcon className="h-4 w-4" strokeWidth={1.75} />
              Назад
            </Button>

            {step < STEPS.length - 1 ? (
              <Button size="md" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Далее
                <ArrowRightIcon className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            ) : (
              <Button size="md" onClick={finish}>
                Завершить
                <CheckIcon className="h-4 w-4" strokeWidth={2} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
