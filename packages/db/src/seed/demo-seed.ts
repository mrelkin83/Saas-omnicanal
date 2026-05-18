import { createHash } from 'node:crypto';
import { db } from '../client.js';
import {
  superadminUsers,
  saasPlans,
  tenants,
  users,
  customers,
  categories,
  products,
  tenantConfig,
  departments,
} from '../schema/index.js';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function seed() {
  console.log('🌱 Starting demo seed...');

  // ── Superadmin ──────────────────────────────────────────────────────────
  const [superadmin] = await db
    .insert(superadminUsers)
    .values({
      email: 'admin@saas.com',
      passwordHash: hashPassword('Admin123!'),
      fullName: 'Super Admin',
      role: 'superadmin',
    })
    .onConflictDoNothing()
    .returning();

  console.log('✅ Superadmin:', superadmin?.email ?? 'already exists');

  // ── SaaS Plans ──────────────────────────────────────────────────────────
  const planDefs = [
    {
      name: 'Free',
      slug: 'free',
      priceCop: '0',
      billingCycle: 'monthly',
      limits: { conversations: 100, agents: 1, channels: 1, aiMessages: 50 },
      features: { campaigns: false, analytics: false, integrations: false },
      sortOrder: 1,
    },
    {
      name: 'Starter',
      slug: 'starter',
      priceCop: '149000',
      billingCycle: 'monthly',
      limits: { conversations: 2000, agents: 5, channels: 3, aiMessages: 500 },
      features: { campaigns: true, analytics: true, integrations: false },
      sortOrder: 2,
    },
    {
      name: 'Pro',
      slug: 'pro',
      priceCop: '449000',
      billingCycle: 'monthly',
      limits: { conversations: -1, agents: -1, channels: -1, aiMessages: -1 },
      features: { campaigns: true, analytics: true, integrations: true },
      sortOrder: 3,
    },
  ];

  const insertedPlans = await db
    .insert(saasPlans)
    .values(planDefs)
    .onConflictDoNothing()
    .returning();

  console.log('✅ Plans:', insertedPlans.length, 'created');

  const proPlan = insertedPlans.find((p) => p.slug === 'pro') ?? insertedPlans[insertedPlans.length - 1];

  // ── Demo Tenants ─────────────────────────────────────────────────────────
  const tenantDefs = [
    {
      slug: 'restaurante-demo',
      name: 'Restaurante El Buen Sabor',
      businessType: 'restaurant',
      capabilities: ['catalog', 'cart_orders', 'reservations', 'payments'],
    },
    {
      slug: 'clinica-demo',
      name: 'Clínica Salud Total',
      businessType: 'clinic',
      capabilities: ['appointments', 'payments'],
    },
    {
      slug: 'tienda-ropa-demo',
      name: 'Boutique Fashion',
      businessType: 'clothing_store',
      capabilities: ['catalog', 'cart_orders', 'payments', 'delivery'],
    },
    {
      slug: 'salon-belleza-demo',
      name: 'Salón Bella Imagen',
      businessType: 'beauty_salon',
      capabilities: ['appointments', 'payments'],
    },
    {
      slug: 'inmobiliaria-demo',
      name: 'Inmobiliaria Prime',
      businessType: 'real_estate',
      capabilities: ['catalog', 'quotes', 'appointments'],
    },
    {
      slug: 'ferreteria-demo',
      name: 'Ferretería El Clavo',
      businessType: 'hardware_store',
      capabilities: ['catalog', 'cart_orders', 'quotes', 'delivery'],
    },
    {
      slug: 'gimnasio-demo',
      name: 'GymFit Pro',
      businessType: 'gym',
      capabilities: ['appointments', 'payments', 'catalog'],
    },
  ];

  const insertedTenants = await db
    .insert(tenants)
    .values(
      tenantDefs.map((t) => ({
        ...t,
        planId: proPlan?.id,
        isDemo: true,
        aiModel: 'gpt-4o-mini',
        aiTemperature: '0.7',
        mrr: '0',
      })),
    )
    .onConflictDoNothing()
    .returning();

  console.log('✅ Tenants:', insertedTenants.length, 'created');

  // ── Tenant owners, configs, departments, demo customers ──────────────────
  for (const tenant of insertedTenants) {
    await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: `owner@${tenant.slug}.com`,
        passwordHash: hashPassword('Demo123!'),
        fullName: 'Propietario Demo',
        role: 'owner',
        isActive: true,
      })
      .onConflictDoNothing();

    await db
      .insert(tenantConfig)
      .values({
        tenantId: tenant.id,
        key: 'ai_system_prompt',
        value: `Eres el asistente virtual de ${tenant.name}. Responde en español colombiano de forma amable y profesional.`,
      })
      .onConflictDoNothing();

    await db
      .insert(departments)
      .values({
        tenantId: tenant.id,
        name: 'General',
        description: 'Departamento general',
        isActive: true,
      })
      .onConflictDoNothing();

    await db
      .insert(customers)
      .values({
        tenantId: tenant.id,
        phone: '+573001234567',
        fullName: 'Cliente Demo',
        email: `cliente@${tenant.slug}.com`,
      })
      .onConflictDoNothing();
  }

  console.log('✅ Tenant owners, configs, departments, and customers created');

  // ── Demo products for the restaurant ────────────────────────────────────
  const restaurante = insertedTenants.find((t) => t.slug === 'restaurante-demo');
  if (restaurante) {
    const [cat] = await db
      .insert(categories)
      .values({
        tenantId: restaurante.id,
        name: 'Platos principales',
        sortOrder: 1,
      })
      .onConflictDoNothing()
      .returning();

    if (cat) {
      await db
        .insert(products)
        .values([
          {
            tenantId: restaurante.id,
            categoryId: cat.id,
            name: 'Bandeja Paisa',
            description: 'Bandeja paisa tradicional con frijoles, chicharrón, huevo, chorizo y más',
            price: '28000',
            isActive: true,
          },
          {
            tenantId: restaurante.id,
            categoryId: cat.id,
            name: 'Ajiaco Santafereño',
            description: 'Sopa tradicional bogotana con pollo, papas criollas y guascas',
            price: '22000',
            isActive: true,
          },
          {
            tenantId: restaurante.id,
            categoryId: cat.id,
            name: 'Arroz con Pollo',
            description: 'Arroz con pollo guisado, ensalada y patacones',
            price: '18000',
            isActive: true,
          },
        ])
        .onConflictDoNothing();

      console.log('✅ Restaurant demo products created');
    }
  }

  console.log('🎉 Demo seed completed successfully!');
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
