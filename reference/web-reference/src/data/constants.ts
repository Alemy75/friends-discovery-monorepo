import type { Intent } from '../types'

export const INTENT_LABELS: Record<Intent, string> = {
  walks: 'Прогулки по городу',
  'double-dates': 'Дабл-дейты',
  hobby: 'Общее хобби',
  travel: 'Совместные поездки',
  'deep-talks': 'Глубокие разговоры',
  events: 'Вечеринки и события',
}

export const ALL_INTENTS = Object.keys(INTENT_LABELS) as Intent[]

/** Curated interest chips offered during onboarding. */
export const INTEREST_OPTIONS = [
  'Кофе',
  'Настолки',
  'Бег',
  'Кино',
  'Походы',
  'Вино',
  'Фотография',
  'Книги',
  'Йога',
  'Велосипед',
  'Готовка',
  'Музыка',
  'Искусство',
  'Стартапы',
  'Путешествия',
  'Сноуборд',
  'Театр',
  'Подкасты',
  'Керамика',
  'Скалолазание',
]
