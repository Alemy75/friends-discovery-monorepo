import type { Profile, MatchThread } from '../types'

// Portrait helpers — higher-res stock faces (600px). Fallback handled per image.
const face = (n: number) => `https://i.pravatar.cc/600?img=${n}`
const w = face
const m = face

/** Candidate deck shown in Discovery. Mix of singles and couples. */
export const CANDIDATES: Profile[] = [
  {
    id: 'p1',
    kind: 'single',
    people: [{ name: 'Аня Соколова', age: 27 }],
    photos: [w(21)],
    city: 'Москва',
    bio: 'Дизайнер продукта. Ищу компанию для утренних пробежек и походов по выставкам.',
    interests: ['Бег', 'Искусство', 'Кофе', 'Фотография'],
    intents: ['walks', 'hobby', 'deep-talks'],
    compatibility: 92,
    likesYou: true,
  },
  {
    id: 'p2',
    kind: 'couple',
    people: [
      { name: 'Марк', age: 31 },
      { name: 'Лена', age: 29 },
    ],
    photos: [m(8), w(44)],
    city: 'Санкт-Петербург',
    bio: 'Пара, которая скучает по дабл-дейтам. Любим вино, настолки и долгие ужины.',
    interests: ['Вино', 'Настолки', 'Готовка', 'Кино'],
    intents: ['double-dates', 'events'],
    compatibility: 87,
    likesYou: true,
  },
  {
    id: 'p3',
    kind: 'single',
    people: [{ name: 'Дмитрий Орлов', age: 34 }],
    photos: [m(11)],
    city: 'Москва',
    bio: 'Фаундер на паузе. Велосипед по выходным, подкасты про космос и много кофе.',
    interests: ['Велосипед', 'Стартапы', 'Подкасты', 'Кофе'],
    intents: ['hobby', 'deep-talks'],
    compatibility: 78,
    likesYou: false,
  },
  {
    id: 'p4',
    kind: 'couple',
    people: [
      { name: 'Игорь', age: 28 },
      { name: 'Соня', age: 27 },
    ],
    photos: [m(12), w(28)],
    city: 'Казань',
    bio: 'Обожаем путешествовать вдвоём, но ищем друзей для совместных поездок и походов.',
    interests: ['Путешествия', 'Походы', 'Фотография', 'Музыка'],
    intents: ['travel', 'walks', 'double-dates'],
    compatibility: 84,
    likesYou: false,
  },
  {
    id: 'p5',
    kind: 'single',
    people: [{ name: 'Катя Волкова', age: 25 }],
    photos: [w(26)],
    city: 'Москва',
    bio: 'Керамистка. Веду вечерние гончарные посиделки и всегда рада новым людям.',
    interests: ['Керамика', 'Искусство', 'Йога', 'Вино'],
    intents: ['hobby', 'events'],
    compatibility: 81,
    likesYou: true,
  },
  {
    id: 'p6',
    kind: 'single',
    people: [{ name: 'Павел Титов', age: 30 }],
    photos: [m(54)],
    city: 'Новосибирск',
    bio: 'Скалолаз и любитель книжных клубов. Ищу тех, с кем можно и на стену, и в тишину.',
    interests: ['Скалолазание', 'Книги', 'Кофе', 'Походы'],
    intents: ['hobby', 'deep-talks', 'travel'],
    compatibility: 74,
    likesYou: false,
  },
  {
    id: 'p7',
    kind: 'couple',
    people: [
      { name: 'Настя', age: 26 },
      { name: 'Кирилл', age: 28 },
    ],
    photos: [w(29), m(14)],
    city: 'Санкт-Петербург',
    bio: 'Театралы и гурманы. Хотим найти пару, с которой можно ходить на премьеры.',
    interests: ['Театр', 'Кино', 'Готовка', 'Вино'],
    intents: ['double-dates', 'events', 'deep-talks'],
    compatibility: 89,
    likesYou: true,
  },
  {
    id: 'p8',
    kind: 'single',
    people: [{ name: 'Марина Гусева', age: 29 }],
    photos: [w(32)],
    city: 'Москва',
    bio: 'Продакт-менеджер, сноубордистка зимой и велосипедистка летом. За активные выходные.',
    interests: ['Сноуборд', 'Велосипед', 'Стартапы', 'Музыка'],
    intents: ['travel', 'events'],
    compatibility: 76,
    likesYou: false,
  },
  {
    id: 'p9',
    kind: 'single',
    people: [{ name: 'Тимур Асланов', age: 32 }],
    photos: [m(60)],
    city: 'Казань',
    bio: 'Фотограф. Снимаю город на плёнку, варю фильтр-кофе и ищу единомышленников.',
    interests: ['Фотография', 'Кофе', 'Искусство', 'Прогулки'],
    intents: ['walks', 'hobby'],
    compatibility: 83,
    likesYou: false,
  },
  {
    id: 'p10',
    kind: 'couple',
    people: [
      { name: 'Оля', age: 30 },
      { name: 'Женя', age: 33 },
    ],
    photos: [w(34), m(59)],
    city: 'Москва',
    bio: 'Дважды родители, снова хотим социальной жизни. Настолки, вино, тёплые компании.',
    interests: ['Настолки', 'Вино', 'Кино', 'Готовка'],
    intents: ['double-dates', 'deep-talks'],
    compatibility: 80,
    likesYou: true,
  },
  {
    id: 'p11',
    kind: 'single',
    people: [{ name: 'Лиза Морозова', age: 24 }],
    photos: [w(27)],
    city: 'Санкт-Петербург',
    bio: 'Иллюстратор и книжный червь. Ищу спокойных друзей для галерей и кофеен.',
    interests: ['Книги', 'Искусство', 'Кофе', 'Йога'],
    intents: ['walks', 'deep-talks'],
    compatibility: 71,
    likesYou: false,
  },
  {
    id: 'p12',
    kind: 'single',
    people: [{ name: 'Артём Белов', age: 35 }],
    photos: [m(18)],
    city: 'Москва',
    bio: 'Марафонец и энтузиаст подкастов. За ранние подъёмы и осмысленные разговоры.',
    interests: ['Бег', 'Подкасты', 'Книги', 'Путешествия'],
    intents: ['hobby', 'deep-talks', 'travel'],
    compatibility: 79,
    likesYou: true,
  },
]

/** Seed chat history for a match, keyed by profile id. */
export function seedThread(profile: Profile): MatchThread {
  const name = profile.people[0].name.split(' ')[0]
  return {
    profileId: profile.id,
    messages: [
      {
        id: `${profile.id}-m1`,
        from: profile.id,
        text: `Привет! Рад(а), что мы совпали 👋 Заметил(а) у тебя ${profile.interests[0].toLowerCase()} в интересах.`,
        time: '10:24',
      },
      {
        id: `${profile.id}-m2`,
        from: 'me',
        text: `Привет, ${name}! Да, обожаю. Как насчёт как-нибудь пересечься?`,
        time: '10:26',
      },
      {
        id: `${profile.id}-m3`,
        from: profile.id,
        text: 'С удовольствием. На выходных свободны — предлагай место ☕',
        time: '10:27',
      },
    ],
  }
}

/** Canned replies for the demo chat auto-responder. */
export const CANNED_REPLIES = [
  'Звучит отлично 🙂',
  'Договорились! Скину пару вариантов.',
  'Отличная идея, я за.',
  'Ха, у нас правда много общего.',
  'Супер, тогда до встречи!',
]
