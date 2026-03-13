import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../libs/prisma/src/lib/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

const DOCUMENTS = [
  { filename: 'Руководство_пользователя.pdf', mime_type: 'application/pdf' },
  { filename: 'Техническое_задание.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { filename: 'Финансовый_отчет.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { filename: 'Презентация_проекта.pptx', mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { filename: 'Заметки_совещания.txt', mime_type: 'text/plain' },
  { filename: 'План_разработки.md', mime_type: 'text/markdown' },
  { filename: 'Данные_клиентов.csv', mime_type: 'text/csv' },
  { filename: 'Конфигурация_сервера.json', mime_type: 'application/json' },
  { filename: 'Инструкция_по_установке.html', mime_type: 'text/html' },
  { filename: 'Архитектура_системы.xml', mime_type: 'application/xml' },
  { filename: 'Лог_ошибок.log', mime_type: 'text/plain' },
  { filename: 'Документация_API.rst', mime_type: 'text/x-rst' },
  { filename: 'Скриншот_интерфейса.png', mime_type: 'image/png' },
  { filename: 'Фото_офиса.jpg', mime_type: 'image/jpeg' },
  { filename: 'Договор_поставки.doc', mime_type: 'application/msword' },
  { filename: 'Отчет_аудита.odt', mime_type: 'application/vnd.oasis.opendocument.text' },
  { filename: 'Политика_безопасности.rtf', mime_type: 'application/rtf' },
  { filename: 'Диаграмма_процессов.tiff', mime_type: 'image/tiff' },
  { filename: 'Макет_страницы.bmp', mime_type: 'image/bmp' },
  { filename: 'Баннер_сайта.webp', mime_type: 'image/webp' },
];

const MAX_USER_ID = 29572992;

async function main() {
  // Удаляем тестовую организацию и её документы
  await prisma.organization.deleteMany({ where: { max_user_id: 1 } });
  console.log('Удалена тестовая организация (max_user_id=1)');

  const org = await prisma.organization.findUnique({
    where: { max_user_id: MAX_USER_ID },
  });

  if (!org) {
    console.error(`Организация с max_user_id=${MAX_USER_ID} не найдена`);
    process.exit(1);
  }

  console.log(`Организация: id=${org.id}, name=${org.name}`);

  for (const doc of DOCUMENTS) {
    const content = `тестовые данные - файл(${doc.filename})`;

    const created = await prisma.document.create({
      data: {
        organization_id: org.id,
        filename: doc.filename,
        mime_type: doc.mime_type,
        status: 'ready',
        chunk_count: 3,
        chunks: {
          createMany: {
            data: [
              { chunk_index: 0, content, qdrant_id: crypto.randomUUID() },
              { chunk_index: 1, content, qdrant_id: crypto.randomUUID() },
              { chunk_index: 2, content, qdrant_id: crypto.randomUUID() },
            ],
          },
        },
      },
    });

    console.log(`  ✅ ${created.filename} (id=${created.id})`);
  }

  console.log(`\nГотово: создано ${DOCUMENTS.length} документов.`);
}

main()
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
