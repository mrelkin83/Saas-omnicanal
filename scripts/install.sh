#!/bin/bash
# =============================================================================
# Instalador automático — SaaS Omnicanal
# Uso: curl -fsSL https://raw.githubusercontent.com/mrelkin83/Saas-omnicanal/main/scripts/install.sh | bash
#      o bien: bash scripts/install.sh
#
# Compatible con: Ubuntu 22.04 / 24.04 LTS
# Requiere: acceso root
# =============================================================================

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
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
log()     { echo -e "${GREEN}[OK]${NC} $*" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"  | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; exit 1; }
info()    { echo -e "${BLUE}[...]${NC} $*"  | tee -a "$LOG_FILE"; }
header()  { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}\n"; }
divider() { echo -e "${CYAN}-----------------------------------------------------------${NC}"; }

# Lee una línea desde /dev/tty y elimina \r (SSH envía \r\n al presionar Enter)
# Uso: readtty VAR  o  readtty -s VAR (silencioso para contraseñas)
readtty() {
  local _silent=0
  if [[ "${1:-}" == "-s" ]]; then
    _silent=1
    shift
  fi
  local _varname="$1"
  local _val=""
  if [[ $_silent -eq 1 ]]; then
    IFS= read -rs _val < /dev/tty || true
    echo "" >&2
  else
    IFS= read -r _val < /dev/tty || true
  fi
  _val="${_val//$'\r'/}"
  printf -v "$_varname" '%s' "$_val"
}

require_root() {
  [[ $EUID -ne 0 ]] && error "Ejecuta como root: sudo bash $0"
}

gen_secret() { openssl rand -hex 48 | cut -c1-64; }
gen_key32()  { openssl rand -base64 32 | tr -d '\n'; }
gen_hex32()  { openssl rand -hex 32; }

# ── Banner ────────────────────────────────────────────────────────────────────
show_banner() {
  clear
  echo -e "${BOLD}${CYAN}"
  echo "  +-----------------------------------------------+"
  echo "  |       SaaS Omnicanal - Autoinstalador         |"
  echo "  |  WhatsApp . IA . Pagos . Panel SuperAdmin      |"
  echo "  +-----------------------------------------------+"
  echo -e "${NC}"
  echo -e "  Log: ${LOG_FILE}"
  echo ""
}

# ── Recolectar configuracion ──────────────────────────────────────────────────
collect_config() {
  header "Configuracion inicial"
  echo "Completa los datos requeridos. Enter para valores por defecto."
  echo ""

  # Dominio
  echo -n "[?] Dominio (ej: app.tudominio.co): "
  readtty DOMAIN
  [[ -z "$DOMAIN" ]] && error "El dominio es obligatorio."

  # Email superadmin
  echo -n "[?] Email del superadmin: "
  readtty SA_EMAIL
  [[ -z "$SA_EMAIL" ]] && error "El email es obligatorio."

  # Nombre superadmin
  echo -n "[?] Nombre del superadmin [Super Admin]: "
  readtty SA_NAME
  SA_NAME="${SA_NAME:-Super Admin}"

  # Password superadmin
  echo -n "[?] Contrasena del superadmin (min 8 caracteres): "
  readtty -s SA_PASSWORD
  [[ ${#SA_PASSWORD} -lt 8 ]] && error "La contrasena debe tener al menos 8 caracteres."

  # Generar secretos
  info "Generando claves seguras..."
  POSTGRES_PASSWORD=$(gen_hex32)
  JWT_SECRET=$(gen_secret)
  ENCRYPTION_KEY=$(gen_key32)
  EVOLUTION_KEY=$(gen_hex32)

  echo ""
  divider
  echo ""
  echo -e "${BOLD}Resumen:${NC}"
  echo -e "  Dominio:    ${CYAN}${DOMAIN}${NC}"
  echo -e "  SuperAdmin: ${CYAN}${SA_EMAIL}${NC}"
  echo -e "  Directorio: ${CYAN}${INSTALL_DIR}${NC}"
  echo ""
  echo -n "[?] Continuar con la instalacion? (s/N): "
  readtty CONFIRM
  if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo "Instalacion cancelada."
    exit 0
  fi
  echo ""
}

# ── Sistema y dependencias ────────────────────────────────────────────────────
install_system_deps() {
  header "Actualizando sistema"

  info "Actualizando lista de paquetes..."
  apt-get update -y 2>&1 | tee -a "$LOG_FILE" | tail -3

  info "Instalando dependencias base..."
  apt-get install -y \
    curl wget git jq ufw openssl ca-certificates \
    gnupg lsb-release apt-transport-https \
    2>&1 | tee -a "$LOG_FILE" | tail -3

  log "Dependencias instaladas"
}

# ── Docker ────────────────────────────────────────────────────────────────────
install_docker() {
  header "Instalando Docker"

  if command -v docker &>/dev/null; then
    log "Docker ya instalado: $(docker --version)"
  else
    info "Descargando e instalando Docker..."
    curl -fsSL https://get.docker.com | sh 2>&1 | tee -a "$LOG_FILE" | tail -5
    systemctl enable docker --now 2>&1 | tee -a "$LOG_FILE" || true
    log "Docker instalado: $(docker --version)"
  fi

  if ! docker compose version &>/dev/null; then
    info "Instalando Docker Compose plugin..."
    apt-get install -y docker-compose-plugin 2>&1 | tee -a "$LOG_FILE" | tail -3
  fi

  log "Docker Compose: $(docker compose version)"
}

# ── Firewall ──────────────────────────────────────────────────────────────────
configure_firewall() {
  header "Configurando firewall"

  ufw --force reset        >> "$LOG_FILE" 2>&1
  ufw default deny incoming  >> "$LOG_FILE" 2>&1
  ufw default allow outgoing >> "$LOG_FILE" 2>&1
  ufw allow ssh              >> "$LOG_FILE" 2>&1
  ufw allow 80/tcp           >> "$LOG_FILE" 2>&1
  ufw allow 443/tcp          >> "$LOG_FILE" 2>&1
  ufw allow 443/udp          >> "$LOG_FILE" 2>&1
  ufw --force enable         >> "$LOG_FILE" 2>&1

  log "Firewall activo (SSH + 80 + 443)"
}

# ── Clonar repo ───────────────────────────────────────────────────────────────
clone_repo() {
  header "Clonando repositorio"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    warn "Ya existe $INSTALL_DIR — actualizando..."
    git -C "$INSTALL_DIR" pull origin main 2>&1 | tee -a "$LOG_FILE" | tail -3
  else
    git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE" | tail -3
  fi

  log "Repositorio en $INSTALL_DIR"
}

# ── Generar .env ──────────────────────────────────────────────────────────────
generate_env() {
  header "Generando .env"

  cat > "$INSTALL_DIR/.env" << ENVFILE
# Base de datos
DATABASE_URL=postgresql://saas:${POSTGRES_PASSWORD}@postgres:5432/saas_omnichannel
POSTGRES_USER=saas
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_URL=redis://redis:6379/0

# Auth
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Dominio
DOMAIN=${DOMAIN}
API_BASE_URL=https://${DOMAIN}
WEB_BASE_URL=https://${DOMAIN}

# LLM — configura tu API key desde Dashboard > Integraciones
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-4o-mini

# WhatsApp (Evolution API)
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_GLOBAL_KEY=${EVOLUTION_KEY}

# Instagram Bridge
INSTAGRAM_BRIDGE_URL=http://instagram-bridge:8000
IG_POLL_INTERVAL_SECONDS=20

# Facebook / TikTok
FB_RATE_LIMIT_PER_MINUTE=15
TT_POLL_INTERVAL_SECONDS=60

# Wompi — configura credenciales por tenant desde Dashboard > Integraciones

# API
API_PORT=3001
API_HOST=0.0.0.0
WEB_PORT=3000
NODE_ENV=production
LOG_LEVEL=info
ENVFILE

  chmod 600 "$INSTALL_DIR/.env"
  log ".env generado"
}

# ── Iniciar servicios ─────────────────────────────────────────────────────────
start_services() {
  header "Iniciando servicios Docker"
  info "El primer build puede tardar 10-20 minutos..."

  cd "$INSTALL_DIR"
  docker compose -f docker/docker-compose.yml up -d --build 2>&1 | tee -a "$LOG_FILE" | tail -10
  log "Contenedores iniciados"

  info "Esperando PostgreSQL..."
  local retries=0
  until docker compose -f docker/docker-compose.yml exec -T postgres \
        pg_isready -U saas -d saas_omnichannel > /dev/null 2>&1; do
    retries=$((retries + 1))
    [[ $retries -ge 60 ]] && error "PostgreSQL no respondio en 120 segundos. Revisa: docker compose logs postgres"
    sleep 2
  done
  log "PostgreSQL listo"

  info "Esperando API..."
  retries=0
  until curl -sf http://localhost:3001/health > /dev/null 2>&1; do
    retries=$((retries + 1))
    [[ $retries -ge 60 ]] && error "API no respondio en 120 segundos. Revisa: docker compose logs api"
    sleep 2
  done
  log "API respondiendo en localhost:3001"
}

# ── Migraciones ───────────────────────────────────────────────────────────────
run_migrations() {
  header "Ejecutando migraciones"

  cd "$INSTALL_DIR"
  docker compose -f docker/docker-compose.yml exec -T api \
    node -e "
      import('./dist/packages/db/src/migrate.js')
        .then(m => m.runMigrations ? m.runMigrations() : m.default())
        .then(() => { console.log('Migraciones OK'); process.exit(0); })
        .catch(e => { console.error(e.message); process.exit(1); })
    " 2>&1 | tee -a "$LOG_FILE" || warn "Verifica las migraciones: docker compose logs api"

  log "Migraciones completadas"
}

# ── SuperAdmin ────────────────────────────────────────────────────────────────
create_superadmin() {
  header "Creando SuperAdmin"

  cd "$INSTALL_DIR"
  docker compose -f docker/docker-compose.yml exec -T api \
    node dist/scripts/create-superadmin.js \
      "$SA_EMAIL" "$SA_PASSWORD" "$SA_NAME" 2>&1 | tee -a "$LOG_FILE" \
    && log "SuperAdmin creado: $SA_EMAIL" \
    || warn "Error creando superadmin. Intenta manualmente: ver DEPLOY.md"
}

# ── Backups ───────────────────────────────────────────────────────────────────
setup_backups() {
  header "Configurando backups"

  mkdir -p /opt/scripts /var/backups/postgres
  cp "$INSTALL_DIR/scripts/backup-postgres.sh" /opt/scripts/
  chmod +x /opt/scripts/backup-postgres.sh

  (crontab -l 2>/dev/null | grep -v "backup-postgres"; \
   echo "0 2 * * * POSTGRES_USER=saas POSTGRES_DB=saas_omnichannel PG_CONTAINER=\$(docker ps --filter 'ancestor=pgvector/pgvector:pg16' -q | head -1) /opt/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1") \
  | crontab -

  log "Backup diario a las 2:00 AM configurado"
}

# ── Verificacion ──────────────────────────────────────────────────────────────
verify_installation() {
  header "Verificacion"

  cd "$INSTALL_DIR"
  echo ""
  docker compose -f docker/docker-compose.yml ps
  echo ""

  local health=""
  health=$(curl -sf "http://localhost:3001/health" 2>/dev/null || echo '{"status":"sin respuesta"}')
  echo -e "  API Health: ${CYAN}${health}${NC}"
  divider
}

# ── Resumen final ─────────────────────────────────────────────────────────────
show_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}+=========================================+${NC}"
  echo -e "${BOLD}${GREEN}|      Instalacion completada!            |${NC}"
  echo -e "${BOLD}${GREEN}+=========================================+${NC}"
  echo ""
  echo -e "${BOLD}Acceso:${NC}"
  echo -e "  App:        ${CYAN}https://${DOMAIN}${NC}"
  echo -e "  SuperAdmin: ${CYAN}https://${DOMAIN}/superadmin${NC}"
  echo -e "  API Docs:   ${CYAN}https://${DOMAIN}/api/docs${NC}"
  echo ""
  echo -e "${BOLD}SuperAdmin:${NC}"
  echo -e "  Email:      ${CYAN}${SA_EMAIL}${NC}"
  echo ""
  echo -e "${BOLD}Proximos pasos:${NC}"
  echo -e "  1. Apunta el DNS: ${CYAN}${DOMAIN} -> $(curl -sf ifconfig.me 2>/dev/null || echo 'IP_DEL_VPS')${NC}"
  echo -e "  2. Configura tu IA en: Dashboard > Integraciones > OpenAI o Groq"
  echo -e "  3. Conecta WhatsApp: Dashboard > Canales > Nuevo canal"
  echo -e "  4. Configura Wompi por tenant: Dashboard > Integraciones > Wompi"
  echo ""
  echo -e "${BOLD}Comandos utiles:${NC}"
  echo -e "  Estado:     docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml ps"
  echo -e "  Logs:       docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml logs -f"
  echo -e "  Actualizar: cd ${INSTALL_DIR} && git pull && docker compose -f docker/docker-compose.yml up -d --build api web"
  echo ""
  echo -e "  Config: ${CYAN}${INSTALL_DIR}/.env${NC}"
  echo -e "  Log:    ${CYAN}${LOG_FILE}${NC}"
  echo ""

  cat > "$INSTALL_DIR/INSTALL_INFO.txt" << INFO
Instalacion SaaS Omnicanal
==========================
Fecha:        $(date '+%Y-%m-%d %H:%M:%S')
Dominio:      https://${DOMAIN}
SuperAdmin:   ${SA_EMAIL}
Directorio:   ${INSTALL_DIR}
Log:          ${LOG_FILE}
INFO

  log "Info guardada en ${INSTALL_DIR}/INSTALL_INFO.txt"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"

  show_banner
  require_root
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
