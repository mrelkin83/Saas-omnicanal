import bcrypt from 'bcryptjs';
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

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function seed() {
  console.log('🌱 Starting demo seed...');

  // ── Superadmin ──────────────────────────────────────────────────────────
  const [superadmin] = await db
    .insert(superadminUsers)
    .values({
      email: 'admin@saas.com',
      passwordHash: await hash('Admin123!'),
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
      slug: 'glamournails',
      name: 'Glamour Nails',
      businessType: 'beauty_salon',
      capabilities: ['appointments', 'payments', 'catalog'],
      ownerEmail: 'owner@glamournails.co',
      ownerPassword: 'Owner123!',
      ownerName: 'Valentina Morales',
      agentEmail: 'agent1@glamournails.co',
      agentPassword: 'Agent123!',
      agentName: 'Sofía García',
    },
    {
      slug: 'restaurante-demo',
      name: 'Restaurante El Buen Sabor',
      businessType: 'restaurant',
      capabilities: ['catalog', 'cart_orders', 'reservations', 'payments'],
      ownerEmail: 'owner@restaurante-demo.co',
      ownerPassword: 'Owner123!',
      ownerName: 'Carlos Rodríguez',
    },
    {
      slug: 'clinica-demo',
      name: 'Clínica Salud Total',
      businessType: 'clinic',
      capabilities: ['appointments', 'payments'],
      ownerEmail: 'owner@clinica-demo.co',
      ownerPassword: 'Owner123!',
      ownerName: 'Dr. Andrés López',
    },
    {
      slug: 'tienda-electronica',
      name: 'TechStore Colombia',
      businessType: 'electronics_store',
      capabilities: ['catalog', 'cart_orders', 'payments', 'delivery'],
      ownerEmail: 'owner@techstore.co',
      ownerPassword: 'Owner123!',
      ownerName: 'Miguel Torres',
    },
    {
      slug: 'taller-demo',
      name: 'Taller Mecánico Punto Fix',
      businessType: 'auto_repair',
      capabilities: ['appointments', 'quotes', 'payments'],
      ownerEmail: 'owner@tallerfix.co',
      ownerPassword: 'Owner123!',
      ownerName: 'Jorge Herrera',
    },
    {
      slug: 'abogado-demo',
      name: 'Estudio Jurídico Lex',
      businessType: 'law_firm',
      capabilities: ['appointments', 'quotes'],
      ownerEmail: 'owner@estudiolegal.co',
      ownerPassword: 'Owner123!',
      ownerName: 'Dra. María Fernanda Ruiz',
    },
    {
      slug: 'hotel-demo',
      name: 'Hotel Andino Boutique',
      businessType: 'hotel',
      capabilities: ['reservations', 'payments', 'catalog'],
      ownerEmail: 'owner@hotelAndino.co',
      ownerPassword: 'Owner123!',
      ownerName: 'Alejandro Mendoza',
    },
  ] as const;

  const insertedTenants: Array<{ id: string; slug: string; name: string }> = [];

  for (const t of tenantDefs) {
    const [tenant] = await db
      .insert(tenants)
      .values({
        slug: t.slug,
        name: t.name,
        businessType: t.businessType,
        capabilities: [...t.capabilities],
        planId: proPlan?.id,
        isDemo: true,
        aiModel: 'gpt-4o-mini',
        aiTemperature: '0.7',
        mrr: '0',
      })
      .onConflictDoNothing()
      .returning();

    if (!tenant) continue;
    insertedTenants.push({ id: tenant.id, slug: t.slug, name: t.name });

    // Owner user
    await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: t.ownerEmail,
        passwordHash: await hash(t.ownerPassword),
        fullName: t.ownerName,
        role: 'owner',
        isActive: true,
      })
      .onConflictDoNothing();

    // Agent user (for glamournails only)
    if ('agentEmail' in t) {
      await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email: t.agentEmail,
          passwordHash: await hash(t.agentPassword),
          fullName: t.agentName,
          role: 'agent',
          isActive: true,
        })
        .onConflictDoNothing();
    }

    // AI system prompt config
    await db
      .insert(tenantConfig)
      .values({
        tenantId: tenant.id,
        key: 'ai_system_prompt',
        value: `Eres el asistente virtual de ${t.name}. Responde en español colombiano de forma amable y profesional.`,
      })
      .onConflictDoNothing();

    // Default department
    await db
      .insert(departments)
      .values({
        tenantId: tenant.id,
        name: 'General',
        description: 'Departamento general',
        isActive: true,
      })
      .onConflictDoNothing();

    // Demo customer
    await db
      .insert(customers)
      .values({
        tenantId: tenant.id,
        phone: '+573001234567',
        fullName: 'Cliente Demo',
        email: `cliente@${t.slug}.co`,
      })
      .onConflictDoNothing();
  }

  console.log('✅ Tenants:', insertedTenants.length, 'created');
  console.log('✅ Tenant owners, agents, configs, departments, and customers created');

  // ── Demo products for Glamour Nails ──────────────────────────────────────
  const glamour = insertedTenants.find((t) => t.slug === 'glamournails');
  if (glamour) {
    const [cat] = await db
      .insert(categories)
      .values({ tenantId: glamour.id, name: 'Servicios de uñas', sortOrder: 1 })
      .onConflictDoNothing()
      .returning();

    if (cat) {
      await db
        .insert(products)
        .values([
          { tenantId: glamour.id, categoryId: cat.id, name: 'Manicure clásica', price: '25000', type: 'service', durationMinutes: 45, isActive: true },
          { tenantId: glamour.id, categoryId: cat.id, name: 'Pedicure spa', price: '35000', type: 'service', durationMinutes: 60, isActive: true },
          { tenantId: glamour.id, categoryId: cat.id, name: 'Uñas acrílicas', price: '80000', type: 'service', durationMinutes: 90, isActive: true },
          { tenantId: glamour.id, categoryId: cat.id, name: 'Nail art', price: '15000', type: 'service', durationMinutes: 30, isActive: true },
          { tenantId: glamour.id, categoryId: cat.id, name: 'Semipermanente', price: '55000', type: 'service', durationMinutes: 60, isActive: true },
          { tenantId: glamour.id, categoryId: cat.id, name: 'Manicure + Pedicure', price: '55000', type: 'service', durationMinutes: 90, isActive: true },
        ])
        .onConflictDoNothing();

      console.log('✅ Glamour Nails services created');
    }
  }

  // ── Demo products for restaurant ─────────────────────────────────────────
  const restaurante = insertedTenants.find((t) => t.slug === 'restaurante-demo');
  if (restaurante) {
    const [cat] = await db
      .insert(categories)
      .values({ tenantId: restaurante.id, name: 'Platos principales', sortOrder: 1 })
      .onConflictDoNothing()
      .returning();

    if (cat) {
      await db
        .insert(products)
        .values([
          { tenantId: restaurante.id, categoryId: cat.id, name: 'Bandeja Paisa', description: 'Bandeja paisa tradicional con frijoles, chicharrón, huevo, chorizo y más', price: '28000', isActive: true },
          { tenantId: restaurante.id, categoryId: cat.id, name: 'Ajiaco Santafereño', description: 'Sopa tradicional bogotana con pollo, papas criollas y guascas', price: '22000', isActive: true },
          { tenantId: restaurante.id, categoryId: cat.id, name: 'Arroz con Pollo', description: 'Arroz con pollo guisado, ensalada y patacones', price: '18000', isActive: true },
          { tenantId: restaurante.id, categoryId: cat.id, name: 'Sancocho de Gallina', description: 'Sancocho tradicional con gallina criolla', price: '24000', isActive: true },
          { tenantId: restaurante.id, categoryId: cat.id, name: 'Sobrebarriga al Horno', description: 'Sobrebarriga con papa criolla y ensalada', price: '26000', isActive: true },
        ])
        .onConflictDoNothing();
    }
  }

  console.log('🎉 Demo seed completed successfully!');
  console.log(`📧 Login: owner@glamournails.co / Owner123!`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
