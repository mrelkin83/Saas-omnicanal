#!/bin/bash
# =============================================================================
# Instalador automatico — SaaS Omnicanal
# Uso: curl -fsSL https://raw.githubusercontent.com/mrelkin83/Saas-omnicanal/main/scripts/install.sh | bash
#      o bien: bash scripts/install.sh
# Compatible: Ubuntu 22.04 / 24.04 LTS — requiere root
# =============================================================================

set -euo pipefail

INSTALL_DIR="/opt/saas"
REPO_URL="https://github.com/mrelkin83/Saas-omnicanal"
SCRIPT_URL="https://raw.githubusercontent.com/mrelkin83/Saas-omnicanal/main/scripts/install.sh"
LOG_FILE="/var/log/saas-install.log"

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()    { echo -e "${GREEN}[OK]${NC} $*"    | tee -a "$LOG_FILE"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"   | tee -a "$LOG_FILE"; }
err()    { echo -e "${RED}[ERROR]${NC} $*"  | tee -a "$LOG_FILE"; exit 1; }
info()   { echo -e "${BLUE}[...]${NC} $*"   | tee -a "$LOG_FILE"; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}\n"; }
div()    { echo -e "${CYAN}-----------------------------------------------------------${NC}"; }

gen_hex32()  { openssl rand -hex 32; }
gen_secret() { openssl rand -hex 48 | cut -c1-64; }
gen_key32()  { openssl rand -base64 32 | tr -d '\n'; }

# Wrapper que garantiza que docker compose siempre use el .env correcto.
# Sin --env-file, compose busca el .env en el directorio del compose file
# (/opt/saas/docker/) en lugar del directorio raiz (/opt/saas/).
dc() { docker compose -f "$INSTALL_DIR/docker/docker-compose.yml" \
              --env-file "$INSTALL_DIR/.env" "$@"; }

# ── Auto-bootstrap ────────────────────────────────────────────────────────────
# Cuando se ejecuta via "curl | bash", stdin es la pipe de curl, no el terminal.
# Detectamos eso con -t 0 (stdin es tty?) y si no lo es, descargamos el script
# a un archivo temporal y lo re-ejecutamos con stdin conectado al terminal real.
# Esto garantiza que todos los `read` funcionen correctamente.
bootstrap() {
  if [[ ! -t 0 ]]; then
    echo "Descargando instalador..."
    local _tmp
    _tmp=$(mktemp /tmp/saas-install-XXXXXX.sh)
    if ! curl -fsSL "$SCRIPT_URL" -o "$_tmp" 2>/dev/null; then
      rm -f "$_tmp"
      echo "ERROR: No se pudo descargar el instalador. Verifica la conexion."
      exit 1
    fi
    chmod +x "$_tmp"
    echo "Iniciando instalador..."
    exec bash "$_tmp" </dev/tty
    # exec reemplaza este proceso — nada de lo siguiente se ejecuta
  fi
}

# ── Banner ────────────────────────────────────────────────────────────────────
show_banner() {
  clear
  echo -e "${BOLD}${CYAN}"
  echo "  +------------------------------------------------+"
  echo "  |      SaaS Omnicanal - Autoinstalador           |"
  echo "  |  WhatsApp . IA . Pagos . Panel SuperAdmin       |"
  echo "  +------------------------------------------------+"
  echo -e "${NC}"
  echo -e "  Log de instalacion: ${LOG_FILE}"
  echo ""
}

# ── Configuracion ─────────────────────────────────────────────────────────────
collect_config() {
  header "Configuracion"
  echo "Ingresa los datos para configurar la plataforma."
  echo ""

  # En este punto stdin ya es el terminal (garantizado por bootstrap)
  printf '%b[?]%b Dominio (ej: app.tudominio.co): ' "$YELLOW" "$NC"
  read -r DOMAIN
  DOMAIN="${DOMAIN//$'\r'/}"
  [[ -z "$DOMAIN" ]] && err "El dominio es obligatorio."

  printf '%b[?]%b Email del superadmin: ' "$YELLOW" "$NC"
  read -r SA_EMAIL
  SA_EMAIL="${SA_EMAIL//$'\r'/}"
  [[ -z "$SA_EMAIL" ]] && err "El email es obligatorio."

  printf '%b[?]%b Nombre del superadmin [Super Admin]: ' "$YELLOW" "$NC"
  read -r SA_NAME
  SA_NAME="${SA_NAME//$'\r'/}"
  SA_NAME="${SA_NAME:-Super Admin}"

  printf '%b[?]%b Contrasena del superadmin (min 8 caracteres): ' "$YELLOW" "$NC"
  read -rs SA_PASSWORD
  SA_PASSWORD="${SA_PASSWORD//$'\r'/}"
  echo ""
  [[ ${#SA_PASSWORD} -lt 8 ]] && err "La contrasena debe tener minimo 8 caracteres."

  info "Generando claves seguras..."
  POSTGRES_PASSWORD=$(gen_hex32)
  JWT_SECRET=$(gen_secret)
  ENCRYPTION_KEY=$(gen_key32)
  EVOLUTION_KEY=$(gen_hex32)

  echo ""
  div
  echo -e "\n${BOLD}Resumen de instalacion:${NC}"
  echo -e "  Dominio:      ${CYAN}${DOMAIN}${NC}"
  echo -e "  SuperAdmin:   ${CYAN}${SA_EMAIL}${NC}"
  echo -e "  Directorio:   ${CYAN}${INSTALL_DIR}${NC}\n"

  printf '%b[?]%b Confirmar instalacion (s/N): ' "$YELLOW" "$NC"
  read -r CONFIRM
  CONFIRM="${CONFIRM//$'\r'/}"
  [[ ! "$CONFIRM" =~ ^[sS]$ ]] && { echo "Instalacion cancelada."; exit 0; }
  echo ""
}

# ── Sistema ───────────────────────────────────────────────────────────────────
install_system_deps() {
  header "Actualizando sistema"
  info "Actualizando repositorios..."
  apt-get update 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Get|Ign|Hit|Err|Reading|Building|W:)" || true
  info "Instalando dependencias..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl wget git jq ufw openssl ca-certificates \
    gnupg lsb-release apt-transport-https \
    2>&1 | tee -a "$LOG_FILE" | grep -E "^(Setting|Unpacking|Selecting|Get|Already)" || true
  log "Dependencias instaladas"
}

# ── Docker ────────────────────────────────────────────────────────────────────
install_docker() {
  header "Instalando Docker"
  if command -v docker &>/dev/null; then
    log "Docker ya instalado: $(docker --version)"
  else
    info "Instalando Docker (esto tarda unos minutos)..."
    curl -fsSL https://get.docker.com | sh 2>&1 | tee -a "$LOG_FILE" | grep -E "^(#|\+|$)" | head -20 || true
    systemctl enable docker --now 2>&1 | tee -a "$LOG_FILE" || true
    log "Docker instalado: $(docker --version)"
  fi
  if ! docker compose version &>/dev/null 2>&1; then
    info "Instalando Docker Compose plugin..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin \
      2>&1 | tee -a "$LOG_FILE" | grep -E "^(Setting|Unpacking)" || true
  fi
  log "Docker Compose: $(docker compose version)"
}

# ── Firewall ──────────────────────────────────────────────────────────────────
configure_firewall() {
  header "Configurando firewall"
  ufw --force reset        2>&1 | tee -a "$LOG_FILE" > /dev/null
  ufw default deny incoming  2>&1 | tee -a "$LOG_FILE" > /dev/null
  ufw default allow outgoing 2>&1 | tee -a "$LOG_FILE" > /dev/null
  ufw allow ssh              2>&1 | tee -a "$LOG_FILE" > /dev/null
  ufw allow 80/tcp           2>&1 | tee -a "$LOG_FILE" > /dev/null
  ufw allow 443/tcp          2>&1 | tee -a "$LOG_FILE" > /dev/null
  ufw allow 443/udp          2>&1 | tee -a "$LOG_FILE" > /dev/null
  ufw --force enable         2>&1 | tee -a "$LOG_FILE" > /dev/null
  log "Firewall activo (SSH + 80 + 443)"
}

# ── Repositorio ───────────────────────────────────────────────────────────────
clone_repo() {
  header "Clonando repositorio"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    warn "Ya existe $INSTALL_DIR — actualizando con git pull..."
    git -C "$INSTALL_DIR" pull origin main 2>&1 | tee -a "$LOG_FILE" || true
  else
    # Directorio existe pero sin .git (clon previo incompleto) — limpiar
    if [[ -d "$INSTALL_DIR" ]]; then
      warn "Directorio $INSTALL_DIR incompleto — eliminando y clonando de nuevo..."
      rm -rf "$INSTALL_DIR"
    fi
    git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"
  fi
  log "Repositorio listo en $INSTALL_DIR"
}

# ── Variables de entorno ──────────────────────────────────────────────────────
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

# LLM — configura desde Dashboard > Integraciones
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-4o-mini

# WhatsApp
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_GLOBAL_KEY=${EVOLUTION_KEY}

# Instagram Bridge
INSTAGRAM_BRIDGE_URL=http://instagram-bridge:8000
IG_POLL_INTERVAL_SECONDS=20

# Facebook / TikTok
FB_RATE_LIMIT_PER_MINUTE=15
TT_POLL_INTERVAL_SECONDS=60

# API
API_PORT=3001
API_HOST=0.0.0.0
WEB_PORT=3000
NODE_ENV=production
LOG_LEVEL=info
ENVFILE
  chmod 600 "$INSTALL_DIR/.env"
  log ".env generado con claves seguras"
}

# ── Servicios Docker ──────────────────────────────────────────────────────────
start_services() {
  header "Iniciando servicios"
  cd "$INSTALL_DIR"

  # Limpiar estado anterior (contenedores + volúmenes) para evitar credenciales stale
  info "Limpiando instalacion anterior si existe..."
  dc down -v --remove-orphans 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Container|Volume|Network)" || true

  info "Construyendo imagenes Docker (puede tardar 10-20 min en primer arranque)..."
  dc up -d --build 2>&1 | tee -a "$LOG_FILE" \
    | grep -E "^( => | --- |Container |Network |Volume |#)" || true

  info "Esperando PostgreSQL..."
  local n=0
  until dc exec -T postgres pg_isready -U saas -d saas_omnichannel >/dev/null 2>&1; do
    n=$((n+1))
    if [[ $n -ge 60 ]]; then
      echo ""
      warn "=== Ultimas lineas de logs de postgres ==="
      dc logs --tail 30 postgres 2>&1 | tee -a "$LOG_FILE" || true
      err "PostgreSQL no respondio en 120s. Ver log completo: dc logs postgres"
    fi
    printf '.'
    sleep 2
  done
  echo ""
  log "PostgreSQL listo"

  info "Esperando API..."
  n=0
  until curl -sf http://localhost:3001/health >/dev/null 2>&1; do
    n=$((n+1))
    if [[ $n -ge 60 ]]; then
      echo ""
      warn "=== Ultimas lineas de logs de api ==="
      dc logs --tail 30 api 2>&1 | tee -a "$LOG_FILE" || true
      err "API no respondio en 120s. Ver log completo: dc logs api"
    fi
    printf '.'
    sleep 2
  done
  echo ""
  log "API lista en :3001"
}

# ── Migraciones ───────────────────────────────────────────────────────────────
run_migrations() {
  header "Migraciones de base de datos"
  dc exec -T api \
    node -e "
      import('./dist/packages/db/src/migrate.js')
        .then(m => { return m.runMigrations ? m.runMigrations() : m.default(); })
        .then(() => { console.log('OK'); process.exit(0); })
        .catch(e => { console.error('Error:', e.message); process.exit(1); })
    " 2>&1 | tee -a "$LOG_FILE" \
    && log "Migraciones aplicadas" \
    || warn "Error en migraciones. Revisa: dc logs api"
}

# ── SuperAdmin ────────────────────────────────────────────────────────────────
create_superadmin() {
  header "Creando SuperAdmin"
  dc exec -T api \
    node dist/scripts/create-superadmin.js "$SA_EMAIL" "$SA_PASSWORD" "$SA_NAME" \
    2>&1 | tee -a "$LOG_FILE" \
    && log "SuperAdmin: $SA_EMAIL" \
    || warn "Error creando superadmin. Intento manual: ver DEPLOY.md"
}

# ── Backups ───────────────────────────────────────────────────────────────────
setup_backups() {
  header "Backups automaticos"
  mkdir -p /opt/scripts /var/backups/postgres
  cp "$INSTALL_DIR/scripts/backup-postgres.sh" /opt/scripts/
  chmod +x /opt/scripts/backup-postgres.sh
  (crontab -l 2>/dev/null | grep -v backup-postgres
   echo "0 2 * * * POSTGRES_USER=saas POSTGRES_DB=saas_omnichannel PG_CONTAINER=\$(docker ps --filter 'ancestor=pgvector/pgvector:pg16' -q | head -1) /opt/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1"
  ) | crontab -
  log "Backup diario a las 2:00 AM"
}

# ── Resumen ───────────────────────────────────────────────────────────────────
show_summary() {
  local _ip
  _ip=$(curl -sf https://ifconfig.me 2>/dev/null || echo "IP_DEL_VPS")

  echo ""
  dc ps 2>/dev/null | tee -a "$LOG_FILE" || true
  echo ""
  div
  echo -e "\n${BOLD}${GREEN}Instalacion completada!${NC}\n"
  echo -e "  App:        ${CYAN}https://${DOMAIN}${NC}"
  echo -e "  SuperAdmin: ${CYAN}https://${DOMAIN}/superadmin${NC}"
  echo -e "  Docs API:   ${CYAN}https://${DOMAIN}/api/docs${NC}"
  echo ""
  echo -e "  SuperAdmin email: ${CYAN}${SA_EMAIL}${NC}"
  echo -e "  Config:           ${CYAN}${INSTALL_DIR}/.env${NC}"
  echo -e "  Log:              ${CYAN}${LOG_FILE}${NC}"
  echo ""
  echo -e "${BOLD}Proximos pasos:${NC}"
  echo -e "  1. DNS: apunta ${BOLD}${DOMAIN}${NC} -> ${CYAN}${_ip}${NC}"
  echo -e "  2. IA:     Dashboard > Integraciones > OpenAI o Groq"
  echo -e "  3. WA:     Dashboard > Canales > Nuevo canal (escanea QR)"
  echo -e "  4. Pagos:  Dashboard > Integraciones > Wompi (por tenant)"
  echo ""
  echo -e "${BOLD}Comandos utiles:${NC}"
  echo -e "  docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml --env-file ${INSTALL_DIR}/.env ps"
  echo -e "  docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml --env-file ${INSTALL_DIR}/.env logs -f"
  echo -e "  cd ${INSTALL_DIR} && git pull && docker compose -f docker/docker-compose.yml --env-file .env up -d --build api web"
  echo ""

  cat > "$INSTALL_DIR/INSTALL_INFO.txt" << INFO
SaaS Omnicanal — Instalacion
Fecha:      $(date '+%Y-%m-%d %H:%M:%S')
Dominio:    https://${DOMAIN}
Admin:      ${SA_EMAIL}
Dir:        ${INSTALL_DIR}
Log:        ${LOG_FILE}
INFO
  log "Info guardada en ${INSTALL_DIR}/INSTALL_INFO.txt"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  # PRIMER paso siempre: garantizar que stdin sea el terminal real
  bootstrap

  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"

  show_banner
  [[ $EUID -ne 0 ]] && err "Ejecuta como root: sudo bash $0"

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
  show_summary
}

main "$@"
