import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function seedDatabase() {
  // This function can be used to re-seed the database programmatically
  // The actual seeding logic is in prisma/seed.ts
  console.log('To seed the database, run: npx prisma db seed');
}
