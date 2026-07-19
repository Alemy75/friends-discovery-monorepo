import { useNavigate } from 'react-router-dom'
import { PencilIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Chip } from '../components/ui/Chip'
import { Textarea, Field } from '../components/ui/Input'
import { StatBlock } from '../components/ui/StatBlock'
import { Avatar, CoupleAvatar } from '../components/ui/Avatar'
import { useApp } from '../store/AppStore'
import { useToast } from '../components/ui/Toast'
import { ALL_INTENTS, INTENT_LABELS, INTEREST_OPTIONS } from '../data/constants'
import { useState } from 'react'
import type { Intent } from '../types'

export function Profile() {
  const { account, stats, updateAccount, logout, reset } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [bioDraft, setBioDraft] = useState(account?.bio ?? '')
  const [editingBio, setEditingBio] = useState(false)

  if (!account) return null

  const displayName =
    account.kind === 'couple'
      ? account.people.map((p) => p.name.split(' ')[0]).join(' & ')
      : account.people[0].name
  const ageLine =
    account.kind === 'couple'
      ? `Пара · ${account.people.map((p) => p.age).join(' и ')}`
      : `${account.people[0].age} лет`

  const toggleInterest = (opt: string) =>
    updateAccount((prev) => ({
      interests: prev.interests.includes(opt)
        ? prev.interests.filter((x) => x !== opt)
        : [...prev.interests, opt],
    }))

  const toggleIntent = (it: Intent) =>
    updateAccount((prev) => ({
      intents: prev.intents.includes(it)
        ? prev.intents.filter((x) => x !== it)
        : [...prev.intents, it],
    }))

  const saveBio = () => {
    updateAccount({ bio: bioDraft.trim() || account.bio })
    setEditingBio(false)
    toast({ title: 'Профиль обновлён' })
  }

  return (
    <div className="mx-auto max-w-[760px] px-5 py-6 md:py-10">
      <h1 className="t-heading-sm text-ink mb-6">Профиль</h1>

      {/* Identity */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          {account.kind === 'couple' ? (
            <CoupleAvatar people={account.people} size={64} />
          ) : (
            <Avatar name={displayName} size={64} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="t-heading-sm text-ink truncate">{displayName}</h2>
              <Badge variant="soft">{account.kind === 'couple' ? 'Пара' : 'Single'}</Badge>
            </div>
            <p className="text-[14px] text-mid-gray">
              {ageLine} · {account.city}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-hairline">
          <StatBlock label="Мэтчи" value={stats.matches} accent />
          <StatBlock label="Лайки" value={stats.likes} />
          <StatBlock label="Просмотрено" value={stats.views} />
        </div>
      </Card>

      {/* Bio */}
      <Card className="mt-4">
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <span className="t-caption text-mid-gray">О себе</span>
            {!editingBio && (
              <button
                className="flex items-center gap-1 text-[13px] text-mid-gray hover:text-ink transition-colors"
                onClick={() => {
                  setBioDraft(account.bio)
                  setEditingBio(true)
                }}
              >
                <PencilIcon className="h-4 w-4" strokeWidth={1.5} />
                Изменить
              </button>
            )}
          </div>
          {editingBio ? (
            <div className="flex flex-col gap-3">
              <Textarea rows={4} value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingBio(false)}>
                  Отмена
                </Button>
                <Button size="sm" onClick={saveBio}>
                  Сохранить
                </Button>
              </div>
            </div>
          ) : (
            <p className="t-body text-ink">{account.bio}</p>
          )}
        </CardBody>
      </Card>

      {/* Interests */}
      <Card className="mt-4">
        <CardBody>
          <span className="t-caption text-mid-gray">Интересы</span>
          <div className="flex flex-wrap gap-2 mt-3">
            {INTEREST_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                selected={account.interests.includes(opt)}
                onClick={() => toggleInterest(opt)}
              >
                {opt}
              </Chip>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Intents */}
      <Card className="mt-4">
        <CardBody>
          <span className="t-caption text-mid-gray">Кого ищете</span>
          <div className="flex flex-wrap gap-2 mt-3">
            {ALL_INTENTS.map((it) => (
              <Chip
                key={it}
                selected={account.intents.includes(it)}
                onClick={() => toggleIntent(it)}
              >
                {INTENT_LABELS[it]}
              </Chip>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Account actions */}
      <Card className="mt-4">
        <CardBody>
          <span className="t-caption text-mid-gray">Аккаунт</span>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              <ArrowRightStartOnRectangleIcon className="h-4 w-4" strokeWidth={1.5} />
              Выйти
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                reset()
                navigate('/')
              }}
            >
              Сбросить демо
            </Button>
          </div>
          <p className="text-[12px] text-mid-gray mt-3">
            «Сбросить демо» очистит профиль, мэтчи и переписку в этом браузере.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
