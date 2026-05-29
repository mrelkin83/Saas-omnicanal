# Guía de Despliegue — SaaS Omnicanal

## Opción rápida: Autoinstalador

Un solo comando configura todo desde cero en Ubuntu 22.04:

```bash
curl -fsSL https://raw.githubusercontent.com/mrelkin83/Saas-omnicanal/main/scripts/install.sh | bash
```

El script instala Docker, configura el firewall, clona el repo, genera `.env` con claves seguras, levanta todos los servicios, ejecuta migraciones, crea el superadmin y programa los backups diarios.

---

## Instalación manual (paso a paso)

## Requisitos del VPS

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU     | 2 vCPU | 4 vCPU      |
| RAM     | 4 GB   | 8 GB        |
| Disco   | 40 GB  | 80 GB SSD   |
| OS      | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

Software previo: **Docker ≥ 24**, **Docker Compose plugin ≥ 2.20**, **Git**.

---

## 1. Preparar el servidor

```bash
# Conectarse al VPS
ssh root@<IP_DEL_VPS>

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Instalar Docker Compose plugin
apt install -y docker-compose-plugin

# Verificar
docker --version
docker compose version
```

---

## 2. Clonar el repositorio

```bash
cd /opt
git clone https://github.com/mrelkin83/Saas-omnicanal saas
cd saas
```

---

## 3. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Valores obligatorios a cambiar:

| Variable | Descripción |
|----------|-------------|
| `DOMAIN` | Dominio real (ej. `app.tudominio.co`) |
| `POSTGRES_PASSWORD` | Contraseña fuerte para PostgreSQL |
| `REDIS_PASSWORD` | Contraseña fuerte para Redis |
| `JWT_SECRET` | Al menos 32 caracteres aleatorios |
| `ENCRYPTION_KEY` | 32 bytes en base64: `openssl rand -base64 32` |
| `EVOLUTION_API_GLOBAL_KEY` | Clave aleatoria para Evolution API |
| `OPENAI_API_KEY` | API key de OpenAI o Groq |
| `API_BASE_URL` | `https://<DOMAIN>` |
| `WEB_BASE_URL` | `https://<DOMAIN>` |
| `CORS_ALLOWED_ORIGINS` | Dominios permitidos para CORS en producción (ej. `https://app.tudominio.co`) |

Generar valores seguros:
```bash
# JWT_SECRET
openssl rand -base64 48

# ENCRYPTION_KEY
openssl rand -base64 32

# EVOLUTION_API_GLOBAL_KEY
openssl rand -hex 32

# REDIS_PASSWORD
openssl rand -hex 32
```

---

## 4. Apuntar el DNS

En tu proveedor DNS, agrega un registro **A**:
```
app.tudominio.co  →  <IP_DEL_VPS>
```

Espera la propagación (puede tardar hasta 10 minutos).

---

## 5. Levantar la aplicación

```bash
# Desde la raíz del repo, construir e iniciar
docker compose -f docker/docker-compose.yml --env-file .env up -d --build

# Ver logs en tiempo real
docker compose -f docker/docker-compose.yml --env-file .env logs -f api web
```

El primer build puede tomar 10–20 minutos. Caddy obtendrá el certificado TLS automáticamente.

---

## 6. Ejecutar migraciones de base de datos

Las migraciones corren automáticamente al iniciar el API (`runMigrations()` en `server.ts`). Si necesitas ejecutarlas manualmente:

```bash
# Dentro del contenedor API
docker compose -f docker/docker-compose.yml --env-file .env exec api \
  node dist/server.js --migrate-only

# O verificar que las tablas existen
docker compose -f docker/docker-compose.yml --env-file .env exec postgres \
  psql -U saas -d saas_omnichannel -c "\dt"
```

---

## 7. Crear el primer superadmin

```bash
docker compose -f docker/docker-compose.yml --env-file .env exec api \
  node dist/scripts/create-superadmin.js admin@tudominio.co "ContrasenaSegura123!" "Super Admin"
```

---

## 8. Verificar el despliegue

```bash
# Health check API
curl https://app.tudominio.co/api/health

# Login superadmin
SA_TOKEN=$(curl -s -X POST https://app.tudominio.co/api/superadmin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tudominio.co","password":"ContrasenaSegura123!"}' \
  | jq -r '.accessToken')

# KPIs
curl -s https://app.tudominio.co/api/superadmin/dashboard \
  -H "Authorization: Bearer $SA_TOKEN" | jq .

# Monitor VPS
curl -s https://app.tudominio.co/api/superadmin/monitor/health \
  -H "Authorization: Bearer $SA_TOKEN" | jq '.cpu, .ram, .disk'
```

---

## 9. Configurar backups automáticos

El `docker-compose.yml` de producción ya incluye un contenedor `backup` que realiza dumps diarios automáticos. Si prefieres usar el script de backup en el host:

```bash
# Copiar script
cp scripts/backup-postgres.sh /opt/scripts/
chmod +x /opt/scripts/backup-postgres.sh

# Agregar cron (backup a las 2am todos los días)
crontab -e
# Añadir:
# 0 2 * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
#   POSTGRES_USER=saas POSTGRES_DB=saas_omnichannel \
#   /opt/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1

# Verificar manual
/opt/scripts/backup-postgres.sh
ls -lh /var/backups/postgres/
```

---

## 10. Actualizaciones

### Pre-update: verificar estado actual
```bash
# Confirmar que todo está healthy antes de actualizar
curl -s https://TU_DOMINIO/api/health | jq .

# Guardar commit actual como punto de rollback
ROLLBACK=$(git -C /opt/saas rev-parse HEAD)
echo "Rollback commit: $ROLLBACK"
```

### Actualizar
```bash
cd /opt/saas
git pull

# Reconstruir solo lo que cambió (api y web)
docker compose -f docker/docker-compose.yml --env-file .env up -d --build api web
```

### Verificar post-update
```bash
# Esperar ~30s a que los contenedores pasen el healthcheck
sleep 30
curl -s https://TU_DOMINIO/api/health | jq .
# Respuesta esperada: { "ok": true, "checks": { "db": { "ok": true }, "redis": { "ok": true } } }

# Ver logs si algo falla
docker compose -f docker/docker-compose.yml --env-file .env logs -f --tail=50
```

### Rollback (si el update falló)
```bash
git -C /opt/saas checkout $ROLLBACK
docker compose -f docker/docker-compose.yml --env-file .env up -d --build api web
sleep 30 && curl -s https://TU_DOMINIO/api/health | jq .
```

> **NUNCA uses `docker compose down -v` en producción** — el flag `-v` elimina los volúmenes de datos (PostgreSQL, Redis). Para detener servicios sin perder datos: `docker compose stop` o `docker compose down` (sin `-v`).

---

## Checklist de seguridad pre-despliegue

| # | Verificación | Comando/Acción |
|---|-------------|----------------|
| 1 | `JWT_SECRET` ≥ 32 caracteres | `wc -c <<< $JWT_SECRET` |
| 2 | `ENCRYPTION_KEY` es base64 válido de 32 bytes | Verificar decodifica correctamente |
| 3 | `NODE_ENV=production` | `docker compose exec api env \| grep NODE_ENV` |
| 4 | `CORS_ALLOWED_ORIGINS` configurado | Verificar `.env` |
| 5 | Redis tiene contraseña | `redis-cli -a $REDIS_PASSWORD ping` |
| 6 | PostgreSQL contraseña fuerte | No usar valores por defecto |
| 7 | Firewall solo 22/80/443 | `ufw status` |
| 8 | Backups configurados | Verificar `/var/backups/postgres/` |
| 9 | Certificado TLS activo | `curl -vI https://TU_DOMINIO` |
| 10 | Healthcheck API responde | `curl https://TU_DOMINIO/api/health` |

---

## Comandos útiles

```bash
# Reiniciar un servicio
docker compose -f docker/docker-compose.yml --env-file .env restart api

# Ver estado de todos los contenedores
docker compose -f docker/docker-compose.yml --env-file .env ps

# Acceder a la base de datos
docker compose -f docker/docker-compose.yml --env-file .env exec postgres \
  psql -U saas -d saas_omnichannel

# Listar backups del contenedor backup
ls -lh /var/lib/docker/volumes/saas_backups/_data/

# Ver uso de disco y RAM
df -h && free -h

# Escalar logs de un servicio específico
docker compose -f docker/docker-compose.yml --env-file .env logs --tail=100 api
```

---

## Troubleshooting

**Caddy no obtiene certificado TLS:**
- Verificar que el DNS apunta al VPS: `dig app.tudominio.co`
- Verificar que los puertos 80 y 443 están abiertos: `ufw allow 80 && ufw allow 443`
- Ver logs de Caddy: `docker compose -f docker/docker-compose.yml --env-file .env logs caddy`

**API no conecta a PostgreSQL:**
- Verificar variables de entorno: `docker compose -f docker/docker-compose.yml --env-file .env exec api env | grep DATABASE`
- Verificar que postgres está healthy: `docker compose -f docker/docker-compose.yml --env-file .env ps postgres`

**WhatsApp QR no aparece:**
- Verificar Evolution API: `docker compose -f docker/docker-compose.yml --env-file .env logs evolution-api`
- La URL del webhook debe ser accesible desde Evolution API: `http://api:3001/api/webhooks/evolution`

**Redis AUTH failed:**
- Verificar que `REDIS_PASSWORD` en `.env` coincide con el valor usado en `docker-compose.yml`
- El contenedor Redis usa `--requirepass`, por lo que la contraseña es obligatoria

---

*Última actualización: 2026-05-29*
