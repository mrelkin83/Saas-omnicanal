# Guía de Despliegue — SaaS Omnicanal

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
git clone <URL_DEL_REPO> saas
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
| `JWT_SECRET` | Al menos 32 caracteres aleatorios |
| `ENCRYPTION_KEY` | 32 bytes en base64: `openssl rand -base64 32` |
| `EVOLUTION_API_GLOBAL_KEY` | Clave aleatoria para Evolution API |
| `OPENAI_API_KEY` | API key de OpenAI o Groq |
| `API_BASE_URL` | `https://<DOMAIN>` |
| `WEB_BASE_URL` | `https://<DOMAIN>` |

Generar valores seguros:
```bash
# JWT_SECRET
openssl rand -base64 48

# ENCRYPTION_KEY
openssl rand -base64 32

# EVOLUTION_API_GLOBAL_KEY
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
docker compose -f docker/docker-compose.yml up -d --build

# Ver logs en tiempo real
docker compose -f docker/docker-compose.yml logs -f api web
```

El primer build puede tomar 5–10 minutos. Caddy obtendrá el certificado TLS automáticamente.

---

## 6. Ejecutar migraciones de base de datos

```bash
# Dentro del contenedor API, ejecutar migraciones
docker compose -f docker/docker-compose.yml exec api \
  node -e "import('./dist/packages/db/src/migrate.js').then(m => m.runMigrations())"

# O si tienes acceso al host con pnpm instalado:
DATABASE_URL="postgresql://saas:<PASSWORD>@localhost:5432/saas_omnichannel" \
  pnpm --filter @saas/db db:migrate
```

---

## 7. Crear el primer superadmin

```bash
docker compose -f docker/docker-compose.yml exec api \
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

```bash
# Copiar script
cp scripts/backup-postgres.sh /opt/scripts/
chmod +x /opt/scripts/backup-postgres.sh

# Agregar cron (backup a las 2am todos los días)
crontab -e
# Añadir:
# 0 2 * * * POSTGRES_USER=saas POSTGRES_DB=saas_omnichannel /opt/scripts/backup-postgres.sh

# Verificar manual
/opt/scripts/backup-postgres.sh
ls -lh /var/backups/postgres/
```

---

## 10. Actualizaciones

```bash
cd /opt/saas
git pull

# Reconstruir solo lo que cambió
docker compose -f docker/docker-compose.yml up -d --build api web

# Ver logs
docker compose -f docker/docker-compose.yml logs -f --tail=50
```

---

## Comandos útiles

```bash
# Reiniciar un servicio
docker compose -f docker/docker-compose.yml restart api

# Ver estado de todos los contenedores
docker compose -f docker/docker-compose.yml ps

# Acceder a la base de datos
docker compose -f docker/docker-compose.yml exec postgres \
  psql -U saas -d saas_omnichannel

# Listar backups
ls -lh /var/backups/postgres/

# Ver uso de disco y RAM
df -h && free -h
```

---

## Troubleshooting

**Caddy no obtiene certificado TLS:**
- Verificar que el DNS apunta al VPS: `dig app.tudominio.co`
- Verificar que los puertos 80 y 443 están abiertos: `ufw allow 80 && ufw allow 443`
- Ver logs de Caddy: `docker compose -f docker/docker-compose.yml logs caddy`

**API no conecta a PostgreSQL:**
- Verificar variables de entorno: `docker compose -f docker/docker-compose.yml exec api env | grep DATABASE`
- Verificar que postgres está healthy: `docker compose -f docker/docker-compose.yml ps postgres`

**WhatsApp QR no aparece:**
- Verificar Evolution API: `docker compose -f docker/docker-compose.yml logs evolution-api`
- La URL del webhook debe ser accesible desde Evolution API: `http://api:3001/api/webhooks/evolution`
