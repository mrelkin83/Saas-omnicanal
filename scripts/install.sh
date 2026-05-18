#!/bin/bash
# =============================================================================
# Instalador automático — SaaS Omnicanal
# Uso: curl -fsSL https://raw.githubusercontent.com/mrelkin83/Saas-omnicanal/main/scripts/install.sh | bash
#      o bien: bash scripts/install.sh
#
# Compatible con: Ubuntu 22.04 LTS
# Requiere: acceso root o sudo
# =============================================================================

set -euo pipefail

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

INSTALL_DIR="/opt/saas"
REPO_URL="https://github.com/mrelkin83/Saas-omnicanal"
LOG_FILE="/var/log/saas-install.log"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()     { echo -e "${GREEN}[✓]${NC} $*" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[✗]${NC} $*" | tee -a "$LOG_FILE"; exit 1; }
info()    { echo -e "${BLUE}[→]${NC} $*" | tee -a "$LOG_FILE"; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}\n"; }
ask()     { echo -e "${YELLOW}[?]${NC} $1"; }
divider() { echo -e "${CYAN}────────────────────────────────────────────────────────${NC}"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    error "Este script debe ejecutarse como root. Usa: sudo bash $0"
  fi
}

check_os() {
  if ! grep -q "Ubuntu 22.04" /etc/os-release 2>/dev/null; then
    warn "Este script fue probado en Ubuntu 22.04. Tu OS puede tener diferencias."
  fi
}

gen_secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-64; }
gen_key32()  { openssl rand -base64 32 | tr -d '\n'; }
gen_hex32()  { openssl rand -hex 32; }

# ── Banner ────────────────────────────────────────────────────────────────────
show_banner() {
  clear
  echo -e "${BOLD}${CYAN}"
  echo "  ╔═══════════════════════════════════════════════╗"
  echo "  ║        SaaS Omnicanal — Autoinstalador        ║"
  echo "  ║   WhatsApp · IA · Pagos · Panel SuperAdmin    ║"
  echo "  ╚═══════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "  Log: ${LOG_FILE}"
  echo ""
}

# ── Recolección de variables ───────────────────────────────────────────────────
collect_config() {
  # Cuando el script llega via curl | bash, stdin es la pipe (ya agotada).
  # Redirigimos stdin desde /dev/tty para que los read lean del terminal real.
  exec < /dev/tty

  header "Configuración inicial"
  echo -e "Completa los siguientes datos. Presiona Enter para aceptar el valor por defecto."
  echo ""

  # Dominio
  ask "Dominio de la aplicación (ej: app.tudominio.co):"
  read -r DOMAIN
  [[ -z "$DOMAIN" ]] && error "El dominio es obligatorio."

  # Email superadmin
  ask "Email del superadmin:"
  read -r SA_EMAIL
  [[ -z "$SA_EMAIL" ]] && error "El email es obligatorio."

  # Nombre superadmin
  ask "Nombre del superadmin [Super Admin]:"
  read -r SA_NAME
  SA_NAME="${SA_NAME:-Super Admin}"

  # Password superadmin
  ask "Contraseña del superadmin (mínimo 8 caracteres):"
  read -rs SA_PASSWORD
  echo ""
  [[ ${#SA_PASSWORD} -lt 8 ]] && error "La contraseña debe tener al menos 8 caracteres."

  # OpenAI
  ask "OpenAI API Key (sk-... o gsk-... para Groq):"
  read -r OPENAI_API_KEY
  [[ -z "$OPENAI_API_KEY" ]] && warn "Sin API Key de IA el agente no funcionará. Configúrala luego en .env"

  ask "Modelo LLM a usar [gpt-4o-mini]:"
  read -r LLM_MODEL
  LLM_MODEL="${LLM_MODEL:-gpt-4o-mini}"

  # Generar secretos automáticos
  info "Generando claves seguras automáticamente..."
  POSTGRES_PASSWORD=$(gen_hex32)
  JWT_SECRET=$(gen_secret)
  ENCRYPTION_KEY=$(gen_key32)
  EVOLUTION_KEY=$(gen_hex32)

  divider
  echo ""
  echo -e "${BOLD}Configuración a instalar:${NC}"
  echo -e "  Dominio:      ${CYAN}${DOMAIN}${NC}"
  echo -e "  SuperAdmin:   ${CYAN}${SA_EMAIL}${NC}"
  echo -e "  Directorio:   ${CYAN}${INSTALL_DIR}${NC}"
  echo ""
  ask "¿Continuar con la instalación? (s/N):"
  read -r CONFIRM
  [[ ! "$CONFIRM" =~ ^[sS]$ ]] && { echo "Instalación cancelada."; exit 0; }
}

# ── Sistema y dependencias ─────────────────────────────────────────────────────
install_system_deps() {
  header "Actualizando sistema e instalando dependencias"

  apt-get update -qq | tee -a "$LOG_FILE"
  apt-get install -y -qq \
    curl wget git jq ufw openssl ca-certificates \
    gnupg lsb-release apt-transport-https \
    2>> "$LOG_FILE"
  log "Paquetes base instalados"
}

install_docker() {
  header "Instalando Docker"

  if command -v docker &>/dev/null; then
    log "Docker ya instalado: $(docker --version)"
    return
  fi

  curl -fsSL https://get.docker.com | sh >> "$LOG_FILE" 2>&1
  systemctl enable docker --now >> "$LOG_FILE" 2>&1

  if ! docker compose version &>/dev/null; then
    apt-get install -y -qq docker-compose-plugin >> "$LOG_FILE" 2>&1
  fi

  log "Docker instalado: $(docker --version)"
  log "Docker Compose: $(docker compose version)"
}

# ── Firewall ──────────────────────────────────────────────────────────────────
configure_firewall() {
  header "Configurando firewall (ufw)"

  ufw --force reset >> "$LOG_FILE" 2>&1
  ufw default deny incoming >> "$LOG_FILE" 2>&1
  ufw default allow outgoing >> "$LOG_FILE" 2>&1
  ufw allow ssh >> "$LOG_FILE" 2>&1
  ufw allow 80/tcp >> "$LOG_FILE" 2>&1
  ufw allow 443/tcp >> "$LOG_FILE" 2>&1
  ufw allow 443/udp >> "$LOG_FILE" 2>&1
  ufw --force enable >> "$LOG_FILE" 2>&1

  log "Firewall activo: SSH + 80 + 443"
}

# ── Clonar repo ───────────────────────────────────────────────────────────────
clone_repo() {
  header "Clonando repositorio"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    warn "Directorio $INSTALL_DIR ya existe. Haciendo git pull..."
    git -C "$INSTALL_DIR" pull origin main >> "$LOG_FILE" 2>&1
  else
    git clone "$REPO_URL" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
  fi

  log "Repositorio en $INSTALL_DIR"
}

# ── Generar .env ──────────────────────────────────────────────────────────────
generate_env() {
  header "Generando archivo .env"

  cat > "$INSTALL_DIR/.env" <<ENV
# ─── Base de datos ───
DATABASE_URL=postgresql://saas:${POSTGRES_PASSWORD}@postgres:5432/saas_omnichannel
POSTGRES_USER=saas
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# ─── Redis ───
REDIS_URL=redis://redis:6379/0

# ─── Auth ───
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ─── Dominio ───
DOMAIN=${DOMAIN}
API_BASE_URL=https://${DOMAIN}
WEB_BASE_URL=https://${DOMAIN}

# ─── LLM ───
OPENAI_API_KEY=${OPENAI_API_KEY:-SIN_CONFIGURAR}
OPENAI_DEFAULT_MODEL=${LLM_MODEL}

# ─── WhatsApp (Evolution API) ───
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_GLOBAL_KEY=${EVOLUTION_KEY}

# ─── Instagram Bridge ───
INSTAGRAM_BRIDGE_URL=http://instagram-bridge:8000
IG_POLL_INTERVAL_SECONDS=20

# ─── Facebook / TikTok ───
FB_RATE_LIMIT_PER_MINUTE=15
TT_POLL_INTERVAL_SECONDS=60

# ─── Wompi (Pagos) ───
# Configura las credenciales Wompi por tenant en: Dashboard → Integraciones → Wompi
# Cada tenant ingresa su publicKey, privateKey y eventSecret de forma independiente.

# ─── API ───
API_PORT=3001
API_HOST=0.0.0.0
WEB_PORT=3000
NODE_ENV=production
LOG_LEVEL=info
ENV

  chmod 600 "$INSTALL_DIR/.env"
  log ".env generado con claves seguras"
}

# ── Iniciar servicios ─────────────────────────────────────────────────────────
start_services() {
  header "Construyendo e iniciando servicios Docker"
  info "Esto puede tardar 5–15 minutos en el primer arranque..."

  cd "$INSTALL_DIR"
  docker compose -f docker/docker-compose.yml up -d --build >> "$LOG_FILE" 2>&1

  log "Servicios iniciados"

  info "Esperando que PostgreSQL esté listo..."
  local retries=0
  until docker compose -f docker/docker-compose.yml exec -T postgres \
        pg_isready -U saas -d saas_omnichannel &>/dev/null; do
    retries=$((retries + 1))
    [[ $retries -ge 30 ]] && error "PostgreSQL no respondió después de 60 segundos."
    sleep 2
  done
  log "PostgreSQL listo"

  info "Esperando que la API esté lista..."
  retries=0
  until curl -sf http://localhost:3001/health &>/dev/null; do
    retries=$((retries + 1))
    [[ $retries -ge 30 ]] && error "API no respondió después de 60 segundos."
    sleep 2
  done
  log "API respondiendo en localhost:3001"
}

# ── Migraciones ───────────────────────────────────────────────────────────────
run_migrations() {
  header "Ejecutando migraciones de base de datos"

  cd "$INSTALL_DIR"
  docker compose -f docker/docker-compose.yml exec -T api \
    node -e "
      import('./dist/packages/db/src/migrate.js')
        .then(m => m.runMigrations ? m.runMigrations() : m.default())
        .then(() => { console.log('Migraciones OK'); process.exit(0); })
        .catch(e => { console.error(e); process.exit(1); })
    " >> "$LOG_FILE" 2>&1 || warn "Verifica las migraciones manualmente si hay errores"

  log "Migraciones completadas"
}

# ── SuperAdmin ────────────────────────────────────────────────────────────────
create_superadmin() {
  header "Creando cuenta SuperAdmin"

  cd "$INSTALL_DIR"
  docker compose -f docker/docker-compose.yml exec -T api \
    node dist/scripts/create-superadmin.js \
      "$SA_EMAIL" "$SA_PASSWORD" "$SA_NAME" >> "$LOG_FILE" 2>&1

  log "SuperAdmin creado: $SA_EMAIL"
}

# ── Backups automáticos ───────────────────────────────────────────────────────
setup_backups() {
  header "Configurando backups automáticos"

  mkdir -p /opt/scripts /var/backups/postgres
  cp "$INSTALL_DIR/scripts/backup-postgres.sh" /opt/scripts/
  chmod +x /opt/scripts/backup-postgres.sh

  # Crontab: backup a las 2:00 AM todos los días
  (crontab -l 2>/dev/null | grep -v "backup-postgres"; \
   echo "0 2 * * * POSTGRES_USER=saas POSTGRES_DB=saas_omnichannel PG_CONTAINER=\$(docker ps --filter 'ancestor=pgvector/pgvector:pg16' -q | head -1) /opt/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1") \
  | crontab -

  log "Backup diario programado a las 2:00 AM"
}

# ── Verificación final ────────────────────────────────────────────────────────
verify_installation() {
  header "Verificación final"

  cd "$INSTALL_DIR"

  # Estado de contenedores
  echo ""
  docker compose -f docker/docker-compose.yml ps
  echo ""

  # Health check
  local health
  health=$(curl -sf "http://localhost:3001/health" || echo '{"status":"sin respuesta"}')
  echo -e "  API Health: ${CYAN}${health}${NC}"

  divider
}

# ── Resumen ───────────────────────────────────────────────────────────────────
show_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║           ¡Instalación completada!                   ║${NC}"
  echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BOLD}URLs de acceso:${NC}"
  echo -e "  Aplicación:   ${CYAN}https://${DOMAIN}${NC}"
  echo -e "  SuperAdmin:   ${CYAN}https://${DOMAIN}/superadmin${NC}"
  echo -e "  API Docs:     ${CYAN}https://${DOMAIN}/api/docs${NC}"
  echo ""
  echo -e "${BOLD}Credenciales SuperAdmin:${NC}"
  echo -e "  Email:        ${CYAN}${SA_EMAIL}${NC}"
  echo -e "  Contraseña:   (la que ingresaste)"
  echo ""
  echo -e "${BOLD}Archivos importantes:${NC}"
  echo -e "  Configuración: ${CYAN}${INSTALL_DIR}/.env${NC}"
  echo -e "  Logs install:  ${CYAN}${LOG_FILE}${NC}"
  echo -e "  Logs docker:   ${CYAN}docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml logs -f${NC}"
  echo ""
  echo -e "${BOLD}Comandos útiles:${NC}"
  echo -e "  Ver servicios: ${CYAN}docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml ps${NC}"
  echo -e "  Reiniciar API: ${CYAN}docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml restart api${NC}"
  echo -e "  Actualizar:    ${CYAN}cd ${INSTALL_DIR} && git pull && docker compose -f docker/docker-compose.yml up -d --build api web${NC}"
  echo ""
  echo -e "${YELLOW}IMPORTANTE:${NC} Asegúrate de que el DNS de ${BOLD}${DOMAIN}${NC} apunte a la IP de este servidor."
  echo -e "Caddy obtendrá el certificado TLS automáticamente cuando el DNS esté propagado."
  echo ""

  # Guardar resumen en archivo
  cat > "$INSTALL_DIR/INSTALL_INFO.txt" <<INFO
Instalación SaaS Omnicanal
==========================
Fecha:        $(date -Iseconds)
Dominio:      https://${DOMAIN}
SuperAdmin:   ${SA_EMAIL}
Directorio:   ${INSTALL_DIR}
Log:          ${LOG_FILE}

Variables generadas automáticamente están en: ${INSTALL_DIR}/.env
INFO

  log "Resumen guardado en ${INSTALL_DIR}/INSTALL_INFO.txt"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"

  show_banner
  require_root
  check_os
  collect_config
  install_system_deps
  install_docker
  configure_firewall
  clone_repo
  generate_env
  start_services
  run_migrations
  create_superadmin
  setup_backups
  verify_installation
  show_summary
}

main "$@"
