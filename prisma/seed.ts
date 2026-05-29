import { prisma } from '../src/lib/prisma.js';
import { defaultCategories } from '../src/services/defaults.js';

async function main(): Promise<void> {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log('Users exist; skipping seed.');
    return;
  }
  console.log('No users yet; seed will run when first user registers.');
  console.log('Default categories available:', defaultCategories.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
