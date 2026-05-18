import '../env.js';
import bcrypt from 'bcryptjs';
import { db, superadminUsers, eq } from '@saas/db';

const EMAIL = process.argv[2] ?? 'admin@saas.com';
const PASSWORD = process.argv[3] ?? 'Admin123!';
const FULL_NAME = process.argv[4] ?? 'Super Admin';

async function main(): Promise<void> {
  const existing = await db.select({ id: superadminUsers.id }).from(superadminUsers).where(eq(superadminUsers.email, EMAIL));
  if (existing.length > 0) {
    console.log(`Superadmin with email ${EMAIL} already exists.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [user] = await db.insert(superadminUsers).values({
    email: EMAIL,
    passwordHash,
    fullName: FULL_NAME,
    role: 'superadmin',
    isActive: true,
  }).returning({ id: superadminUsers.id, email: superadminUsers.email });

  console.log(`Superadmin created: ${user!.email} (id: ${user!.id})`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
