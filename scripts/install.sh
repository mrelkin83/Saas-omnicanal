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
    # Pasar $@ para que argumentos como el dominio lleguen al script re-ejecutado
    exec bash "$_tmp" "$@" </dev/tty
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
# Uso interactivo:  bash install.sh
# Uso sin prompts:  bash install.sh app.tudominio.co
# Via curl+arg:     curl -fsSL URL | bash -s -- app.tudominio.co
collect_config() {
  header "Configuracion"

  # Si el dominio llego como argumento, usarlo directamente (sin prompts)
  DOMAIN="${1:-}"
  DOMAIN="${DOMAIN//$'\r'/}"

  if [[ -z "$DOMAIN" ]]; then
    echo "Ingresa los datos para configurar la plataforma."
    echo ""

    # Intentar leer desde /dev/tty; si falla, pedir que se pase como argumento
    printf "  Dominio (ej. app.tuempresa.co): " >/dev/tty 2>/dev/null || true
    if read -r DOMAIN </dev/tty 2>/dev/null; then
      DOMAIN="${DOMAIN//$'\r'/}"
    fi

    if [[ -z "$DOMAIN" ]]; then
      err "No se pudo leer el dominio. Ejecuta: bash $0 app.tudominio.co"
    fi
  fi

  # Credenciales del superadmin — genera password aleatorio
  SA_EMAIL="admin@demo.com"
  SA_NAME="Administrador"
  SA_PASSWORD=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)

  info "Generando claves seguras..."
  POSTGRES_PASSWORD=$(gen_hex32)
  JWT_SECRET=$(gen_secret)
  ENCRYPTION_KEY=$(gen_key32)
  EVOLUTION_KEY=$(gen_hex32)
  REDIS_PASSWORD=$(gen_hex32)

  echo ""
  div
  echo -e "\n${BOLD}Resumen de instalacion:${NC}"
  echo -e "  Dominio:      ${CYAN}${DOMAIN}${NC}"
  echo -e "  SuperAdmin:   ${CYAN}${SA_EMAIL}${NC}"
  echo -e "  Directorio:   ${CYAN}${INSTALL_DIR}${NC}\n"
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

# ── Verificacion de recursos ──────────────────────────────────────────────────
check_resources() {
  header "Verificando recursos del VPS"

  local ram_gb disk_gb
  ram_gb=$(free -m | awk '/^Mem:/{printf "%.0f", $2/1024}')
  disk_gb=$(df -BG "$INSTALL_DIR" 2>/dev/null | awk 'NR==2{gsub(/G/,"");print $4}' || echo "0")
  [[ "$disk_gb" == "0" ]] && disk_gb=$(df -BG / 2>/dev/null | awk 'NR==2{gsub(/G/,"");print $4}')

  info "RAM detectada: ${ram_gb} GB | Disco libre: ${disk_gb} GB"

  if [[ "$ram_gb" -lt 3 ]]; then
    err "RAM insuficiente: ${ram_gb} GB (minimo 4 GB recomendado). El despliegue puede fallar o ser extremadamente lento."
  fi
  if [[ "$disk_gb" -lt 15 ]]; then
    err "Disco insuficiente: ${disk_gb} GB libres (minimo 20 GB recomendado)."
  fi

  log "Recursos OK — RAM: ${ram_gb} GB | Disco: ${disk_gb} GB"
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

  # Verificar que BuildKit está activo (necesario para multi-stage builds)
  if [[ "${DOCKER_BUILDKIT:-1}" != "1" ]] && ! docker buildx version &>/dev/null 2>&1; then
    info "Activando Docker BuildKit..."
    export DOCKER_BUILDKIT=1
    echo 'export DOCKER_BUILDKIT=1' >> /etc/profile.d/docker-buildkit.sh
  fi
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
    git -C "$INSTALL_DIR" pull origin main 2>&1 | tee -a "$LOG_FILE" \
      || warn "git pull fallo — continuando con el codigo existente (puede estar desactualizado)"
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

  # Idempotencia: si ya existe un .env, preservarlo (evita sobrescribir secretos en produccion)
  if [[ -f "$INSTALL_DIR/.env" ]]; then
    warn "Usando .env existente — para regenerar: rm $INSTALL_DIR/.env y vuelve a ejecutar"
    # shellcheck source=/dev/null
    source "$INSTALL_DIR/.env" 2>/dev/null || true
    return
  fi

  cat > "$INSTALL_DIR/.env" << ENVFILE
# Base de datos
DATABASE_URL=postgresql://saas:${POSTGRES_PASSWORD}@postgres:5432/saas_omnichannel
POSTGRES_USER=saas
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

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

# CORS — restringido en producción
CORS_ALLOWED_ORIGINS=https://${DOMAIN}
ENVFILE
  chmod 600 "$INSTALL_DIR/.env"
  log ".env generado con claves seguras"
}

# ── Servicios Docker ──────────────────────────────────────────────────────────
start_services() {
  header "Iniciando servicios"
  cd "$INSTALL_DIR"

  # Detener contenedores previos pero PRESERVAR volumenes (datos).
  # El flag -v eliminaria pgdata y redisdata — catastrofico en reinstalacion.
  info "Deteniendo contenedores previos (datos preservados)..."
  dc down --remove-orphans 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Container|Network)" || true

  info "Construyendo imagen Instagram Bridge..."
  dc build instagram-bridge 2>&1 | tee -a "$LOG_FILE"

  info "Construyendo imagen API (puede tardar 10-20 min en primer arranque)..."
  dc build api 2>&1 | tee -a "$LOG_FILE"

  info "Construyendo imagen Web..."
  dc build web 2>&1 | tee -a "$LOG_FILE"

  # Levantar infraestructura primero
  info "Iniciando base de datos y cache..."
  dc up -d postgres redis 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Container |Network )" || true

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

  # Levantar todos los servicios
  info "Iniciando todos los servicios..."
  dc up -d 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Container |Network )" || true

  # Esperar API (incluye migraciones automaticas en startup)
  info "Esperando API (incluye migraciones en primer arranque)..."
  n=0
  until dc exec -T api node --input-type=module \
    -e 'const r=await fetch("http://localhost:3001/health").catch(()=>null);process.exit(r?.ok?0:1)' \
    >/dev/null 2>&1; do
    n=$((n+1))
    if [[ $n -ge 120 ]]; then
      echo ""
      warn "=== Ultimas lineas de logs de api ==="
      dc logs --tail 30 api 2>&1 | tee -a "$LOG_FILE" || true
      err "API no respondio en 240s. Ver log completo: dc logs api"
    fi
    printf '.'
    sleep 2
  done
  echo ""
  log "API lista en :3001 (migraciones aplicadas)"
}

# ── Migraciones ───────────────────────────────────────────────────────────────
# Las migraciones corren automaticamente al iniciar el API (antes de app.listen).
# Si el API respondio al healthcheck pero las tablas no existen, algo fallo.
run_migrations() {
  header "Verificando migraciones"
  if dc exec -T postgres psql -U saas -d saas_omnichannel \
      -c "SELECT 1 FROM channel_sessions LIMIT 1" >/dev/null 2>&1; then
    log "Migraciones verificadas (tablas presentes)"
  else
    echo ""
    warn "=== Ultimas lineas de logs del API (migraciones) ==="
    dc logs --tail 40 api 2>&1 | tee -a "$LOG_FILE" || true
    err "Las tablas no existen tras el arranque del API. Ver log: dc logs api"
  fi
}

# ── Verificar servicios ───────────────────────────────────────────────────────
check_all_services() {
  header "Verificando servicios"

  local svc n healthy
  for svc in postgres redis evolution-api instagram-bridge api web caddy; do
    healthy=$(dc ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk -v s="$svc" '$1==s{print $2}')
    if [[ "$healthy" == "healthy" ]]; then
      log "$svc: healthy"
    elif [[ "$svc" == "caddy" ]] || [[ "$svc" == "web" ]]; then
      # Caddy y Web pueden no tener healthcheck definido; verificar que estan running
      if dc ps --services --filter "status=running" 2>/dev/null | grep -q "^${svc}$"; then
        log "$svc: running (sin healthcheck)"
      else
        warn "$svc: no esta corriendo"
      fi
    elif [[ "$svc" == "evolution-api" ]] || [[ "$svc" == "instagram-bridge" ]]; then
      # Servicios externos sin healthcheck definido en compose
      if dc ps --services --filter "status=running" 2>/dev/null | grep -q "^${svc}$"; then
        log "$svc: running"
      else
        warn "$svc: no esta corriendo — revisa los logs con: dc logs $svc"
      fi
    else
      warn "$svc: estado desconocido ($healthy)"
    fi
  done

  # Verificar conectividad entre servicios
  info "Verificando conectividad interna..."
  if dc exec -T api wget -qO- http://evolution-api:8080 >/dev/null 2>&1; then
    log "API -> Evolution API: OK"
  else
    warn "API -> Evolution API: no responde (normal en primer arranque, arranca en segundo plano)"
  fi

  if dc exec -T api wget -qO- http://instagram-bridge:8000 >/dev/null 2>&1; then
    log "API -> Instagram Bridge: OK"
  else
    warn "API -> Instagram Bridge: no responde (normal si aun no ha iniciado)"
  fi
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

# ── Verificar login ───────────────────────────────────────────────────────────
verify_login() {
  header "Verificando login superadmin"
  local result http_code
  # Esperar hasta 30s a que Caddy obtenga el certificado TLS
  local n=0
  until result=$(curl -sf -w '\n%{http_code}' -X POST "https://${DOMAIN}/api/superadmin/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${SA_EMAIL}\",\"password\":\"${SA_PASSWORD}\"}" \
      --max-time 10 2>/dev/null) && \
      http_code=$(echo "$result" | tail -1) && [[ "$http_code" == "200" ]]; do
    n=$((n+1))
    if [[ $n -ge 6 ]]; then
      warn "No se pudo verificar el login via HTTPS (Caddy puede necesitar unos minutos para el certificado TLS)"
      warn "Prueba manualmente: https://${DOMAIN}/superadmin/login"
      return
    fi
    printf '.'
    sleep 5
  done
  echo ""
  log "Login verificado OK — https://${DOMAIN}/superadmin/login funciona correctamente"
}

# ── Backups ───────────────────────────────────────────────────────────────────
setup_backups() {
  header "Backups automaticos"
  mkdir -p /opt/scripts /var/backups/postgres
  cp "$INSTALL_DIR/scripts/backup-postgres.sh" /opt/scripts/
  chmod +x /opt/scripts/backup-postgres.sh

  # Detectar ruta exacta de docker para que el cron (PATH minimo) la encuentre
  local DOCKER_BIN
  DOCKER_BIN=$(command -v docker 2>/dev/null || echo "/usr/bin/docker")

  # grep -v devuelve exit 1 cuando no hay lineas que pasar (crontab vacio),
  # lo que con pipefail mataria el script. El || true lo evita.
  { crontab -l 2>/dev/null | grep -v backup-postgres || true
    echo "0 2 * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin POSTGRES_USER=saas POSTGRES_DB=saas_omnichannel DOCKER_BIN=${DOCKER_BIN} /opt/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1"
  } | crontab - || warn "No se pudo configurar crontab — configura el backup manualmente"
  log "Backup diario a las 2:00 AM (docker: ${DOCKER_BIN})"
}

# ── Resumen ───────────────────────────────────────────────────────────────────
show_summary() {
  local _ip
  _ip=$(curl -sf --max-time 5 https://ifconfig.me 2>/dev/null || echo "IP_DEL_VPS")

  echo ""
  dc ps 2>/dev/null | tee -a "$LOG_FILE" || true
  echo ""
  div
  echo -e "\n${BOLD}${GREEN}Instalacion completada!${NC}\n"
  echo -e "  App:        ${CYAN}https://${DOMAIN}${NC}"
  echo -e "  SuperAdmin: ${CYAN}https://${DOMAIN}/superadmin${NC}"
  echo -e "  Docs API:   ${CYAN}https://${DOMAIN}/api/docs${NC}"
  echo ""
  echo -e "  SuperAdmin email:    ${CYAN}${SA_EMAIL}${NC}"
  echo -e "  SuperAdmin password: ${CYAN}${SA_PASSWORD}${NC}"
  echo -e "  Config:              ${CYAN}${INSTALL_DIR}/.env${NC}"
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
Password:   ${SA_PASSWORD}
Dir:        ${INSTALL_DIR}
Log:        ${LOG_FILE}
INFO
  log "Info guardada en ${INSTALL_DIR}/INSTALL_INFO.txt"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  # PRIMER paso siempre: garantizar que stdin sea el terminal real
  bootstrap "$@"

  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"

  show_banner
  [[ $EUID -ne 0 ]] && err "Ejecuta como root: sudo bash $0"

  collect_config "$@"
  check_resources
  install_system_deps
  install_docker
  configure_firewall
  clone_repo
  generate_env
  start_services
  run_migrations
  check_all_services
  create_superadmin
  verify_login
  setup_backups
  show_summary
}

main "$@"
