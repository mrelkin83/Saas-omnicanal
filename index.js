#!/usr/bin/env node
/**
 * ChatGÜIRE V7 — CLI Maestro / Orquestador de Proyecto
 * -----------------------------------------------------
 * Punto de entrada único para bootstrap, desarrollo, build y diagnóstico.
 * Uso: node index.js [comando]
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const readline = require('readline');

// ── Constantes ──────────────────────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, '.project-state.json');
const ENV_FILE = path.join(__dirname, '.env');
const ENV_EXAMPLE = path.join(__dirname, '.env.example');

const REQUIRED_ENVS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'OPENAI_API_KEY',
];

const COMMANDS = [
  { name: 'doctor', desc: 'Diagnóstico completo del entorno y dependencias' },
  { name: 'setup', desc: 'Instala dependencias, verifica .env, migra DB y seed' },
  { name: 'dev', desc: 'Arranca todos los servicios en modo desarrollo' },
  { name: 'build', desc: 'Compila todos los workspaces' },
  { name: 'status', desc: 'Health checks de Postgres, Redis, API y Web' },
  { name: 'clean', desc: 'Elimina dist, .next y node_modules' },
  { name: 'env:check', desc: 'Valida que .env tenga las variables obligatorias' },
  { name: 'env:generate', desc: 'Genera claves seguras para JWT y ENCRYPTION_KEY' },
];

// ── Utilidades de UI ────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') { console.log(`${c[color]}${msg}${c.reset}`); }
function info(msg) { log(`ℹ️  ${msg}`, 'cyan'); }
function ok(msg) { log(`✅ ${msg}`, 'green'); }
function warn(msg) { log(`⚠️  ${msg}`, 'yellow'); }
function err(msg) { log(`❌ ${msg}`, 'red'); }
function title(msg) { console.log(`\n${c.bold}${c.magenta}▶ ${msg}${c.reset}\n`); }
function divider() { console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`); }

function question(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(`${c.yellow}?${c.reset} ${q} `, (ans) => { rl.close(); resolve(ans.trim()); }));
}

// ── Utilidades de sistema ───────────────────────────────────────────────────
function exec(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const [bin, ...args] = cmd.split(' ');
    const child = spawn(bin, args, {
      stdio: opts.silent ? 'pipe' : 'inherit',
      shell: true,
      cwd: opts.cwd || __dirname,
      env: { ...process.env, ...(opts.env || {}) },
    });
    let stdout = '';
    let stderr = '';
    if (opts.silent) {
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
    }
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `Comando falló con código ${code}`));
      resolve(stdout);
    });
    child.on('error', reject);
  });
}

function execSyncSilent(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: __dirname, stdio: 'pipe' });
  } catch (e) {
    return '';
  }
}

function getNodeVersion() {
  const v = process.version.replace(/^v/, '');
  const major = parseInt(v.split('.')[0], 10);
  return { raw: v, major };
}

function getPnpmVersion() {
  try {
    const out = execSyncSilent('pnpm --version').trim();
    const major = parseInt(out.split('.')[0], 10);
    return { raw: out, major, ok: true };
  } catch {
    return { raw: null, major: 0, ok: false };
  }
}

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const lines = fs.readFileSync(ENV_FILE, 'utf-8').split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function parseDbUrl(url) {
  // postgresql://user:pass@host:port/db
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!m) return null;
  return { user: m[1], pass: m[2], host: m[3], port: parseInt(m[4], 10), db: m[5] };
}

function parseRedisUrl(url) {
  // redis://:pass@host:port/0
  const m = url.match(/^redis:\/\/(?::([^@]+)@)?([^:]+):(\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  return { pass: m[1] || null, host: m[2], port: parseInt(m[3], 10), db: m[4] || '0' };
}

function checkTcp(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Comandos ────────────────────────────────────────────────────────────────

async function cmdDoctor() {
  title('DOCTOR — Diagnóstico del entorno');
  let issues = 0;

  // Node
  const node = getNodeVersion();
  if (node.major >= 20) {
    ok(`Node.js ${node.raw} (requerido >= 20)`);
  } else {
    err(`Node.js ${node.raw} (requerido >= 20)`);
    issues++;
  }

  // pnpm
  const pnpm = getPnpmVersion();
  if (pnpm.ok && pnpm.major >= 10) {
    ok(`pnpm ${pnpm.raw} (requerido >= 10)`);
  } else if (pnpm.ok) {
    warn(`pnpm ${pnpm.raw} (requerido >= 10) — ejecuta: npm install -g pnpm@10.26.1`);
    issues++;
  } else {
    err('pnpm no encontrado — ejecuta: npm install -g pnpm@10.26.1');
    issues++;
  }

  // Git
  const git = execSyncSilent('git --version').trim();
  if (git) ok(git); else { warn('Git no detectado'); issues++; }

  // Docker
  const docker = execSyncSilent('docker --version').trim();
  if (docker) ok(docker); else warn('Docker no detectado (opcional para infra local)');

  divider();

  // .env
  if (fs.existsSync(ENV_FILE)) {
    ok('Archivo .env existe');
    const env = loadEnv();
    for (const key of REQUIRED_ENVS) {
      if (!env[key] || env[key].startsWith('CHANGEME') || env[key] === 'sk-...') {
        err(`Variable ${key} no configurada o tiene valor placeholder`);
        issues++;
      } else {
        ok(`${key} configurado`);
      }
    }

    // Postgres
    const dbCfg = parseDbUrl(env.DATABASE_URL || '');
    if (dbCfg) {
      const reachable = await checkTcp(dbCfg.host, dbCfg.port);
      if (reachable) {
        ok(`PostgreSQL responde en ${dbCfg.host}:${dbCfg.port}`);
      } else {
        err(`PostgreSQL NO responde en ${dbCfg.host}:${dbCfg.port}`);
        info('Asegúrate de que PostgreSQL esté corriendo. Si usas Docker:');
        info('  docker compose -f docker-compose.dev.yml up -d');
        info('O si usas un servicio local, edita DATABASE_URL en .env');
        issues++;
      }
    } else {
      err('DATABASE_URL tiene formato inválido');
      issues++;
    }

    // Redis
    const redisCfg = parseRedisUrl(env.REDIS_URL || '');
    if (redisCfg) {
      const reachable = await checkTcp(redisCfg.host, redisCfg.port);
      if (reachable) {
        ok(`Redis responde en ${redisCfg.host}:${redisCfg.port}`);
      } else {
        err(`Redis NO responde en ${redisCfg.host}:${redisCfg.port}`);
        info('Asegúrate de que Redis esté corriendo. Si usas Docker:');
        info('  docker compose -f docker-compose.dev.yml up -d');
        info('O descarga Redis para Windows desde: https://github.com/tporadowski/redis/releases');
        issues++;
      }
    } else {
      err('REDIS_URL tiene formato inválido');
      issues++;
    }
  } else {
    err('Archivo .env no existe. Ejecuta: node index.js setup');
    issues++;
  }

  divider();

  // Dependencias
  if (fs.existsSync(path.join(__dirname, 'node_modules', '.modules.yaml'))) {
    ok('node_modules instalado (pnpm workspace)');
  } else {
    err('node_modules no encontrado. Ejecuta: node index.js setup');
    issues++;
  }

  // Builds
  const apiDist = path.join(__dirname, 'apps', 'api', 'dist');
  const webDist = path.join(__dirname, 'apps', 'web', '.next');
  if (fs.existsSync(apiDist)) ok('apps/api/dist existe'); else warn('apps/api/dist no existe (ejecuta build si lo necesitas)');
  if (fs.existsSync(webDist)) ok('apps/web/.next existe'); else warn('apps/web/.next no existe (ejecuta build si lo necesitas)');

  divider();
  if (issues === 0) {
    ok('Diagnóstico completado. Todo listo para desarrollar 🚀');
  } else {
    err(`Diagnóstico completado con ${issues} problema(s). Resuélvelos antes de continuar.`);
    process.exit(1);
  }
}

async function cmdEnvCheck() {
  title('Validación de variables de entorno');
  if (!fs.existsSync(ENV_FILE)) {
    err('No existe .env');
    info('Ejecuta: node index.js setup');
    process.exit(1);
  }
  const env = loadEnv();
  let issues = 0;
  for (const key of REQUIRED_ENVS) {
    if (!env[key] || env[key].startsWith('CHANGEME') || env[key] === 'sk-...') {
      err(`${key}: FALTA o tiene valor placeholder`);
      issues++;
    } else {
      ok(`${key}: OK`);
    }
  }
  if (issues) process.exit(1);
}

async function cmdEnvGenerate() {
  title('Generador de claves seguras');
  const crypto = require('crypto');
  const jwtSecret = crypto.randomBytes(48).toString('hex');
  const encKey = crypto.randomBytes(32).toString('base64');
  const evoKey = crypto.randomBytes(16).toString('hex');

  log(`JWT_SECRET=${jwtSecret}`, 'green');
  log(`ENCRYPTION_KEY=${encKey}`, 'green');
  log(`EVOLUTION_API_GLOBAL_KEY=${evoKey}`, 'green');

  info('Copia estos valores en tu archivo .env');
}

async function cmdSetup() {
  title('SETUP — Preparación del proyecto');
  const state = loadState();

  // 1. pnpm
  const pnpm = getPnpmVersion();
  if (!pnpm.ok) {
    info('Instalando pnpm globalmente...');
    await exec('npm install -g pnpm@10.26.1');
    ok('pnpm instalado');
  } else {
    ok(`pnpm ${pnpm.raw} detectado`);
  }

  // 2. .env
  if (!fs.existsSync(ENV_FILE)) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      info('Creando .env desde .env.example...');
      fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
      warn('.env creado con valores placeholder. EDÍTALO antes de continuar.');
      const editNow = await question('¿Deseas pausar para editar .env ahora? (s/n)');
      if (editNow.toLowerCase() === 's' || editNow.toLowerCase() === 'si') {
        info('Abre .env en tu editor, guárdalo y vuelve a ejecutar: node index.js setup');
        process.exit(0);
      }
    } else {
      err('No existe .env.example');
      process.exit(1);
    }
  } else {
    ok('.env existe');
  }

  // 3. Instalar deps
  info('Instalando dependencias del workspace...');
  await exec('pnpm install', { silent: true });
  ok('Dependencias instaladas');

  // 4. Validar conexiones
  const env = loadEnv();
  const dbCfg = parseDbUrl(env.DATABASE_URL || '');
  const redisCfg = parseRedisUrl(env.REDIS_URL || '');

  if (dbCfg) {
    const dbReachable = await checkTcp(dbCfg.host, dbCfg.port);
    if (!dbReachable) {
      err(`PostgreSQL no responde en ${dbCfg.host}:${dbCfg.port}`);
      info('Si usas Docker, levanta la infraestructura:');
      info('  docker compose -f docker-compose.dev.yml up -d');
      info('Si usas PostgreSQL local, asegúrate de que esté iniciado y revisa el puerto en .env');
      process.exit(1);
    }
    ok(`PostgreSQL responde en ${dbCfg.host}:${dbCfg.port}`);
  }

  if (redisCfg) {
    const redisReachable = await checkTcp(redisCfg.host, redisCfg.port);
    if (!redisReachable) {
      err(`Redis no responde en ${redisCfg.host}:${redisCfg.port}`);
      info('Si usas Docker, levanta la infraestructura:');
      info('  docker compose -f docker-compose.dev.yml up -d');
      info('O descarga Redis para Windows desde: https://github.com/tporadowski/redis/releases');
      process.exit(1);
    }
    ok(`Redis responde en ${redisCfg.host}:${redisCfg.port}`);
  }

  // 5. Build de packages
  info('Compilando packages compartidos...');
  await exec('pnpm --filter @saas/shared build', { silent: true });
  await exec('pnpm --filter @saas/db build', { silent: true });
  ok('Packages compilados');

  // 6. Migraciones
  info('Ejecutando migraciones de base de datos...');
  try {
    await exec('pnpm --filter @saas/db db:migrate', { silent: true });
    ok('Migraciones aplicadas');
  } catch (e) {
    err('Error aplicando migraciones');
    console.error(e.message);
    process.exit(1);
  }

  // 7. Seed (preguntar)
  const doSeed = await question('¿Deseas insertar datos de demo (seed)? (s/n)');
  if (doSeed.toLowerCase() === 's' || doSeed.toLowerCase() === 'si') {
    info('Ejecutando seed...');
    try {
      await exec('pnpm --filter @saas/db db:seed', { silent: true });
      ok('Seed completado');
    } catch (e) {
      err('Error en seed');
      console.error(e.message);
    }
  }

  state.setupDone = true;
  saveState(state);

  divider();
  ok('SETUP completado. Ahora ejecuta: node index.js dev');
}

async function cmdBuild() {
  title('BUILD — Compilando todo el workspace');

  // Windows sin permisos de admin suele fallar en el build de Next.js
  // por symlinks en outputFileTracing. Advertimos pero intentamos igual.
  if (os.platform() === 'win32') {
    warn('Windows detectado. El build de Next.js puede fallar por permisos de symlink.');
    info('Si falla, ejecuta la terminal como Administrador o usa:');
    info('  node index.js dev   (modo desarrollo, recomendado en Windows)');
  }

  try {
    await exec('pnpm build');
    ok('Build completado');
  } catch (e) {
    if (os.platform() === 'win32' && String(e.message).includes('EPERM')) {
      err('Build falló por permisos de symlink en Windows.');
      info('Solución: ejecuta como Administrador, o usa:');
      info('  node index.js dev');
    } else {
      throw e;
    }
  }
}

async function cmdDev() {
  title('DEV — Modo desarrollo');

  // Validaciones previas
  const state = loadState();
  if (!state.setupDone) {
    warn('No se detecta setup previo. Ejecutando doctor...');
    try {
      await cmdDoctor();
    } catch {
      process.exit(1);
    }
  }

  // Revisar infra
  const env = loadEnv();
  const dbCfg = parseDbUrl(env.DATABASE_URL || '');
  const redisCfg = parseRedisUrl(env.REDIS_URL || '');
  let infraOk = true;

  if (dbCfg && !(await checkTcp(dbCfg.host, dbCfg.port))) {
    err(`PostgreSQL no responde en ${dbCfg.host}:${dbCfg.port}`);
    infraOk = false;
  }
  if (redisCfg && !(await checkTcp(redisCfg.host, redisCfg.port))) {
    err(`Redis no responde en ${redisCfg.host}:${redisCfg.port}`);
    infraOk = false;
  }

  if (!infraOk) {
    info('Levanta la infraestructura con Docker antes de continuar:');
    info('  docker compose -f docker-compose.dev.yml up -d');
    process.exit(1);
  }

  ok('Infraestructura OK. Arrancando servicios con Turbo...');
  divider();

  // Arrancar turbo dev
  try {
    await exec('pnpm dev');
  } catch {
    // Ctrl+C o error
    process.exit(0);
  }
}

async function cmdStatus() {
  title('STATUS — Health checks');
  const env = loadEnv();

  // Postgres
  const dbCfg = parseDbUrl(env.DATABASE_URL || '');
  if (dbCfg) {
    const r = await checkTcp(dbCfg.host, dbCfg.port);
    r ? ok(`PostgreSQL ${dbCfg.host}:${dbCfg.port}`) : err(`PostgreSQL ${dbCfg.host}:${dbCfg.port}`);
  }

  // Redis
  const redisCfg = parseRedisUrl(env.REDIS_URL || '');
  if (redisCfg) {
    const r = await checkTcp(redisCfg.host, redisCfg.port);
    r ? ok(`Redis ${redisCfg.host}:${redisCfg.port}`) : err(`Redis ${redisCfg.host}:${redisCfg.port}`);
  }

  // API
  const apiPort = env.API_PORT || '3001';
  const apiHost = env.API_HOST || '127.0.0.1';
  const apiReachable = await checkTcp(apiHost, parseInt(apiPort, 10), 2000);
  if (apiReachable) {
    ok(`API escuchando en http://${apiHost}:${apiPort}`);
    try {
      const out = execSyncSilent(`curl -s http://${apiHost}:${apiPort}/health`);
      const health = JSON.parse(out);
      if (health.ok) ok('API /health responde correctamente');
      else warn('API /health responde pero indica no-ok');
    } catch {
      warn('API responde TCP pero /health no devolvió JSON válido');
    }
  } else {
    err(`API no responde en http://${apiHost}:${apiPort}`);
  }

  // Web
  const webPort = env.WEB_PORT || '3000';
  const webReachable = await checkTcp('127.0.0.1', parseInt(webPort, 10), 2000);
  webReachable ? ok(`Web escuchando en http://127.0.0.1:${webPort}`) : err(`Web no responde en http://127.0.0.1:${webPort}`);
}

async function cmdClean() {
  title('CLEAN — Limpieza de builds');
  const dirs = [
    path.join(__dirname, 'apps', 'api', 'dist'),
    path.join(__dirname, 'apps', 'web', '.next'),
    path.join(__dirname, 'packages', 'db', 'dist'),
    path.join(__dirname, 'packages', 'shared', 'dist'),
    path.join(__dirname, '.turbo', 'cache'),
  ];
  for (const d of dirs) {
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
      info(`Eliminado: ${path.relative(__dirname, d)}`);
    }
  }
  ok('Limpieza completada');
}

function showHelp() {
  console.log(`
${c.bold}${c.cyan}ChatGÜIRE V7 — CLI Maestro${c.reset}
${c.dim}Orquestador universal del proyecto SaaS Omnicanal${c.reset}

Uso: node index.js [comando]

Comandos disponibles:
`);
  for (const cmd of COMMANDS) {
    console.log(`  ${c.bold}${cmd.name.padEnd(14)}${c.reset} ${cmd.desc}`);
  }
  console.log(`
Ejemplos:
  node index.js doctor       Revisa que todo esté listo
  node index.js setup        Prepara el proyecto desde cero
  node index.js dev          Arranca API + Web + Bridge
  node index.js status       Verifica que los servicios respondan
`);
}

// ── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  const [,, rawCmd] = process.argv;
  const cmd = (rawCmd || 'help').toLowerCase();

  switch (cmd) {
    case 'doctor': await cmdDoctor(); break;
    case 'setup': await cmdSetup(); break;
    case 'dev': await cmdDev(); break;
    case 'build': await cmdBuild(); break;
    case 'status': await cmdStatus(); break;
    case 'clean': await cmdClean(); break;
    case 'env:check': await cmdEnvCheck(); break;
    case 'env:generate': await cmdEnvGenerate(); break;
    case 'help':
    case '-h':
    case '--help':
    default:
      showHelp();
      break;
  }
}

main().catch((e) => {
  err(`Error inesperado: ${e.message}`);
  console.error(e);
  process.exit(1);
});
