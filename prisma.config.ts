import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'libs/prisma/src/lib/prisma/schema.prisma',
  migrations: {
    path: 'libs/prisma/src/lib/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
