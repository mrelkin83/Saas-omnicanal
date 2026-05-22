import type { FastifyPluginAsync } from 'fastify';
import os from 'node:os';
import { exec } from 'node:child_process';
import { requireSuperAdmin } from '../../middleware/require-superadmin.js';
import { redis } from '../../lib/redis.js';

const CACHE_KEY = 'superadmin:monitor:health';
const CACHE_TTL = 10;

function getCpuPercent(): number {
  const [load1m] = os.loadavg();
  const cores = os.cpus().length;
  return Math.min(100, Math.round((load1m / Math.max(cores, 1)) * 100));
}

function getRamStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalMb: Math.round(total / 1024 / 1024),
    usedMb: Math.round(used / 1024 / 1024),
    freeMb: Math.round(free / 1024 / 1024),
    percent: Math.round((used / total) * 100),
  };
}

function getDiskStats(): Promise<{ totalGb: number; usedGb: number; freeGb: number; percent: number } | null> {
  return new Promise((resolve) => {
    exec('df -B1 / 2>/dev/null | tail -1', { timeout: 2000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const parts = stdout.trim().split(/\s+/);
      if (parts.length < 5) { resolve(null); return; }
      const total = parseInt(parts[1] ?? '0', 10);
      const used = parseInt(parts[2] ?? '0', 10);
      const free = parseInt(parts[3] ?? '0', 10);
      const toGb = (b: number) => Math.round((b / 1024 / 1024 / 1024) * 10) / 10;
      resolve({ totalGb: toGb(total), usedGb: toGb(used), freeGb: toGb(free), percent: Math.round((used / Math.max(total, 1)) * 100) });
    });
  });
}

const superadminMonitorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', { preHandler: [requireSuperAdmin] }, async () => {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as unknown;

    const data = {
      cpu: getCpuPercent(),
      ram: getRamStats(),
      disk: await getDiskStats(),
      uptime: Math.round(os.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      cores: os.cpus().length,
      timestamp: new Date().toISOString(),
    };

    await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL);
    return data;
  });
};

export default superadminMonitorRoutes;
