import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../libs/prisma/src";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { documents: true } } },
  });
  for (const o of orgs) {
    console.log(
      `id=${o.id}  max_user_id=${o.max_user_id}  name=${o.name}  docs=${o._count.documents}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
