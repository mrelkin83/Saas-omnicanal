import bcrypt from 'bcryptjs';
import { db, users, eq, and } from '@saas/db';
import type { CreateUserInput, UpdateUserInput } from './users.schemas.js';

export async function listUsers(tenantId: string) {
  return db.query.users.findMany({
    where: eq(users.tenantId, tenantId),
    columns: {
      passwordHash: false,
    },
  });
}

export async function getUserById(tenantId: string, userId: string) {
  return db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
    columns: { passwordHash: false },
  });
}

export async function createUser(tenantId: string, input: CreateUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role,
      agentStatus: input.agentStatus,
      maxConcurrentChats: input.maxConcurrentChats,
      isActive: true,
    })
    .returning({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      agentStatus: users.agentStatus,
      maxConcurrentChats: users.maxConcurrentChats,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });
  return user;
}

export async function updateUser(tenantId: string, userId: string, input: UpdateUserInput) {
  const updateData: Record<string, unknown> = {};
  if (input.fullName !== undefined) updateData['fullName'] = input.fullName;
  if (input.role !== undefined) updateData['role'] = input.role;
  if (input.agentStatus !== undefined) updateData['agentStatus'] = input.agentStatus;
  if (input.maxConcurrentChats !== undefined) updateData['maxConcurrentChats'] = input.maxConcurrentChats;
  if (input.isActive !== undefined) updateData['isActive'] = input.isActive;

  if (Object.keys(updateData).length === 0) {
    return getUserById(tenantId, userId);
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      agentStatus: users.agentStatus,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return updated ?? null;
}

export async function deleteUser(tenantId: string, userId: string) {
  const [deleted] = await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning({ id: users.id });
  return deleted ?? null;
}
