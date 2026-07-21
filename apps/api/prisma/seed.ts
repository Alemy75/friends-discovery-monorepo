import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INTERESTS: Array<{ slug: string; label: string }> = [
  { slug: 'coffee', label: 'Кофе' },
  { slug: 'boardgames', label: 'Настолки' },
  { slug: 'running', label: 'Бег' },
  { slug: 'cinema', label: 'Кино' },
  { slug: 'hiking', label: 'Походы' },
  { slug: 'wine', label: 'Вино' },
  { slug: 'photography', label: 'Фотография' },
  { slug: 'books', label: 'Книги' },
  { slug: 'yoga', label: 'Йога' },
  { slug: 'cycling', label: 'Велосипед' },
  { slug: 'cooking', label: 'Готовка' },
  { slug: 'music', label: 'Музыка' },
  { slug: 'art', label: 'Искусство' },
  { slug: 'startups', label: 'Стартапы' },
  { slug: 'travel', label: 'Путешествия' },
  { slug: 'snowboard', label: 'Сноуборд' },
  { slug: 'theatre', label: 'Театр' },
  { slug: 'podcasts', label: 'Подкасты' },
  { slug: 'ceramics', label: 'Керамика' },
  { slug: 'climbing', label: 'Скалолазание' },
];

async function main(): Promise<void> {
  await prisma.city.upsert({
    where: { slug: 'yaroslavl' },
    update: { name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 57.6261, centerLng: 39.8845, isActive: true },
    create: { slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 57.6261, centerLng: 39.8845 },
  });

  for (const i of INTERESTS) {
    await prisma.interest.upsert({
      where: { slug: i.slug },
      update: { label: i.label, isActive: true },
      create: i,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
