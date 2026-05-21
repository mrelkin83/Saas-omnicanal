import type { Capability } from './capabilities.js';

export interface BusinessTypeConfig {
  readonly label: string;
  readonly icon: string;
  readonly capabilities: ReadonlyArray<Capability>;
}

export const BUSINESS_TYPES = {

  // ── SALUD: Medicina ────────────────────────────────────────────────────────
  medicina_general:           { label: 'Medicina general',              icon: '🩺', capabilities: ['catalog','appointments','payments'] },
  medicina_especializada:     { label: 'Medicina especializada',        icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  odontologia_general:        { label: 'Odontología general',           icon: '🦷', capabilities: ['catalog','appointments','payments'] },
  ortodoncia:                 { label: 'Ortodoncia',                    icon: '🦷', capabilities: ['catalog','appointments','payments'] },
  endodoncia:                 { label: 'Endodoncia',                    icon: '🦷', capabilities: ['catalog','appointments','payments'] },
  cirugia_maxilofacial:       { label: 'Cirugía maxilofacial',          icon: '🏥', capabilities: ['appointments','payments'] },
  dermatologia:               { label: 'Dermatología',                  icon: '🩺', capabilities: ['catalog','appointments','payments'] },
  pediatria:                  { label: 'Pediatría',                     icon: '👶', capabilities: ['catalog','appointments','payments'] },
  ginecologia:                { label: 'Ginecología',                   icon: '🩺', capabilities: ['catalog','appointments','payments'] },
  cardiologia:                { label: 'Cardiología',                   icon: '❤️', capabilities: ['catalog','appointments','payments'] },
  neurologia:                 { label: 'Neurología',                    icon: '🧠', capabilities: ['catalog','appointments','payments'] },
  oftalmologia:               { label: 'Oftalmología',                  icon: '👁️', capabilities: ['catalog','appointments','payments'] },
  psiquiatria:                { label: 'Psiquiatría',                   icon: '🧠', capabilities: ['appointments','payments'] },
  odontologo:                 { label: 'Odontólogo / Clínica dental',   icon: '🦷', capabilities: ['catalog','appointments','payments'] },

  // ── SALUD: IPS y Centros ──────────────────────────────────────────────────
  ips_primaria:               { label: 'IPS primaria',                  icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  ips_especializada:          { label: 'IPS especializada',             icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  centro_medico:              { label: 'Centro médico',                 icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  clinica:                    { label: 'Clínica',                       icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  hospital:                   { label: 'Hospital',                      icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  centro_rehabilitacion:      { label: 'Centro de rehabilitación',      icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  centro_diagnostico:         { label: 'Centro de diagnóstico',         icon: '🔬', capabilities: ['catalog','appointments','payments'] },
  laboratorio_clinico:        { label: 'Laboratorio clínico',           icon: '🔬', capabilities: ['catalog','appointments','payments'] },
  imagenes_diagnosticas:      { label: 'Imágenes diagnósticas',         icon: '🩻', capabilities: ['catalog','appointments','payments'] },

  // ── SALUD: Alternativa y Terapias ─────────────────────────────────────────
  fisioterapia:               { label: 'Fisioterapia',                  icon: '🏃', capabilities: ['catalog','appointments','payments'] },
  terapia_ocupacional:        { label: 'Terapia ocupacional',           icon: '🤲', capabilities: ['catalog','appointments','payments'] },
  fonoaudiologia:             { label: 'Fonoaudiología',                icon: '🗣️', capabilities: ['catalog','appointments','payments'] },
  psicologia:                 { label: 'Psicología',                    icon: '🧠', capabilities: ['appointments','payments'] },
  quiropraxia:                { label: 'Quiropraxia',                   icon: '🦴', capabilities: ['catalog','appointments','payments'] },
  acupuntura:                 { label: 'Acupuntura',                    icon: '🪡', capabilities: ['catalog','appointments','payments'] },
  medicina_alternativa:       { label: 'Medicina alternativa',          icon: '🌿', capabilities: ['catalog','appointments','payments'] },
  homeopatia:                 { label: 'Homeopatía',                    icon: '🌿', capabilities: ['catalog','appointments','payments'] },
  terapias_holisticas:        { label: 'Terapias holísticas',           icon: '🧘', capabilities: ['catalog','appointments','payments'] },
  nutricionista:              { label: 'Nutricionista',                 icon: '🥗', capabilities: ['catalog','appointments','payments'] },
  optometra:                  { label: 'Optómetra / Óptica',            icon: '👓', capabilities: ['catalog','appointments','payments','cart_orders'] },

  // ── SALUD: Veterinaria y Mascotas ─────────────────────────────────────────
  clinica_veterinaria:        { label: 'Clínica veterinaria',           icon: '🐾', capabilities: ['catalog','appointments','payments','cart_orders'] },
  hospital_veterinario:       { label: 'Hospital veterinario',          icon: '🐾', capabilities: ['catalog','appointments','payments'] },
  veterinario:                { label: 'Veterinario',                   icon: '🐾', capabilities: ['catalog','appointments','payments','cart_orders'] },
  grooming:                   { label: 'Grooming',                      icon: '✂️', capabilities: ['catalog','appointments','payments'] },
  guarderia_canina:           { label: 'Guardería canina',              icon: '🐕', capabilities: ['catalog','appointments','payments'] },
  hotel_mascotas:             { label: 'Hotel para mascotas',           icon: '🐾', capabilities: ['catalog','reservations','payments'] },
  adiestramiento_canino:      { label: 'Adiestramiento',                icon: '🐕', capabilities: ['catalog','appointments','payments'] },
  cirugia_veterinaria:        { label: 'Cirugía veterinaria',           icon: '🔬', capabilities: ['appointments','payments'] },
  tienda_mascotas_vet:        { label: 'Tienda de mascotas / accesorios', icon: '🐾', capabilities: ['catalog','cart_orders','payments','delivery'] },

  // ── JURÍDICO: Derecho ──────────────────────────────────────────────────────
  derecho_civil:              { label: 'Derecho civil',                 icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_penal:              { label: 'Derecho penal',                 icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_laboral:            { label: 'Derecho laboral',               icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_administrativo:     { label: 'Derecho administrativo',        icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_tributario:         { label: 'Derecho tributario',            icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_comercial:          { label: 'Derecho comercial',             icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_internacional:      { label: 'Derecho internacional',         icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_inmobiliario:       { label: 'Derecho inmobiliario',          icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  derecho_familia:            { label: 'Derecho de familia',            icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  abogado_juridico:           { label: 'Abogado / Servicios jurídicos', icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── JURÍDICO: Complementarios ─────────────────────────────────────────────
  notaria:                    { label: 'Notaría',                       icon: '📜', capabilities: ['catalog','appointments','quotes','payments'] },
  conciliacion:               { label: 'Conciliación',                  icon: '🤝', capabilities: ['appointments','quotes','payments'] },
  arbitraje:                  { label: 'Arbitraje',                     icon: '⚖️', capabilities: ['appointments','quotes','payments'] },
  cobro_juridico:             { label: 'Cobro jurídico',                icon: '💼', capabilities: ['catalog','quotes','payments'] },
  asesoria_legal_empresarial: { label: 'Asesoría legal empresarial',    icon: '💼', capabilities: ['catalog','appointments','quotes','payments'] },
  compliance:                 { label: 'Compliance',                    icon: '📋', capabilities: ['catalog','appointments','quotes','payments'] },
  proteccion_datos:           { label: 'Protección de datos / Habeas data', icon: '🛡️', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── EMPRESARIAL: Consultoría ──────────────────────────────────────────────
  consultoria_empresarial:    { label: 'Consultoría empresarial',       icon: '💼', capabilities: ['catalog','appointments','quotes','payments'] },
  consultoria_estrategica:    { label: 'Consultoría estratégica',       icon: '🎯', capabilities: ['catalog','appointments','quotes','payments'] },
  consultoria_financiera:     { label: 'Consultoría financiera',        icon: '📈', capabilities: ['catalog','appointments','quotes','payments'] },
  consultoria_tributaria:     { label: 'Consultoría tributaria',        icon: '📊', capabilities: ['catalog','appointments','quotes','payments'] },
  consultoria_tecnologica:    { label: 'Consultoría tecnológica',       icon: '💻', capabilities: ['catalog','appointments','quotes','payments'] },
  consultoria_innovacion:     { label: 'Consultoría en innovación',     icon: '💡', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── EMPRESARIAL: Recursos Humanos ─────────────────────────────────────────
  reclutamiento:              { label: 'Reclutamiento y selección',     icon: '👥', capabilities: ['catalog','appointments','quotes','payments'] },
  headhunting:                { label: 'Headhunting',                   icon: '🎯', capabilities: ['catalog','appointments','quotes','payments'] },
  outsourcing_rrhh:           { label: 'Outsourcing de nómina',         icon: '📋', capabilities: ['catalog','quotes','payments'] },
  capacitacion_empresarial:   { label: 'Capacitación empresarial',      icon: '📚', capabilities: ['catalog','appointments','payments'] },
  sst:                        { label: 'Seguridad y salud en el trabajo (SST)', icon: '🦺', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── EMPRESARIAL: Contabilidad y Finanzas ──────────────────────────────────
  contabilidad:               { label: 'Contabilidad',                  icon: '📊', capabilities: ['catalog','appointments','quotes','payments'] },
  contador_contabilidad:      { label: 'Contador / Auditoría',          icon: '📊', capabilities: ['catalog','appointments','quotes','payments'] },
  revisoria_fiscal:           { label: 'Revisoría fiscal',              icon: '📋', capabilities: ['catalog','appointments','quotes','payments'] },
  auditoria:                  { label: 'Auditoría',                     icon: '🔍', capabilities: ['catalog','appointments','quotes','payments'] },
  planeacion_tributaria:      { label: 'Planeación tributaria',         icon: '📈', capabilities: ['catalog','appointments','quotes','payments'] },
  asesoria_financiera:        { label: 'Asesoría financiera',           icon: '💰', capabilities: ['catalog','appointments','quotes','payments'] },
  bpo_financiero:             { label: 'BPO financiero',                icon: '🏢', capabilities: ['catalog','quotes','payments'] },

  // ── TECNOLOGÍA: Desarrollo de Software ───────────────────────────────────
  desarrollo_web:             { label: 'Desarrollo web',                icon: '🌐', capabilities: ['catalog','quotes','payments'] },
  desarrollo_movil:           { label: 'Desarrollo móvil',              icon: '📱', capabilities: ['catalog','quotes','payments'] },
  desarrollo_saas:            { label: 'SaaS / Producto digital',       icon: '☁️', capabilities: ['catalog','quotes','payments'] },
  erp_crm:                    { label: 'ERP / CRM',                     icon: '💻', capabilities: ['catalog','quotes','payments'] },
  automatizacion_software:    { label: 'Automatización de procesos',    icon: '⚙️', capabilities: ['catalog','quotes','payments'] },
  desarrollo_apis:            { label: 'APIs / Integraciones',          icon: '🔌', capabilities: ['catalog','quotes','payments'] },

  // ── TECNOLOGÍA: Infraestructura TI ────────────────────────────────────────
  redes_servidores:           { label: 'Redes y servidores',            icon: '🖧', capabilities: ['catalog','quotes','payments'] },
  cloud_computing:            { label: 'Cloud computing',               icon: '☁️', capabilities: ['catalog','quotes','payments'] },
  devops:                     { label: 'DevOps',                        icon: '⚙️', capabilities: ['catalog','quotes','payments'] },
  ciberseguridad:             { label: 'Ciberseguridad',                icon: '🔒', capabilities: ['catalog','quotes','payments'] },
  hosting:                    { label: 'Hosting / Data center',         icon: '🖥️', capabilities: ['catalog','quotes','payments'] },
  soporte_tecnico:            { label: 'Soporte técnico',               icon: '🔧', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── TECNOLOGÍA: IA y Datos ────────────────────────────────────────────────
  machine_learning:           { label: 'Machine Learning / IA',         icon: '🤖', capabilities: ['catalog','quotes','payments'] },
  ia_generativa:              { label: 'IA generativa',                 icon: '🤖', capabilities: ['catalog','quotes','payments'] },
  ciencia_datos:              { label: 'Ciencia de datos',              icon: '📊', capabilities: ['catalog','quotes','payments'] },
  business_intelligence:      { label: 'Business Intelligence',         icon: '📊', capabilities: ['catalog','quotes','payments'] },
  automatizacion_ia:          { label: 'Automatización IA / Chatbots',  icon: '🤖', capabilities: ['catalog','quotes','payments'] },
  agencia_ia:                 { label: 'Agencia de IA',                 icon: '🤖', capabilities: ['catalog','quotes','payments'] },
  automatizacion_whatsapp:    { label: 'Automatización WhatsApp',       icon: '💬', capabilities: ['catalog','quotes','payments'] },
  desarrollo_nocode:          { label: 'Desarrollo No-Code / Low-Code', icon: '⚙️', capabilities: ['catalog','quotes','payments'] },
  ingeniero_sistemas:         { label: 'Ingeniero de sistemas',         icon: '💻', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── MARKETING: Digital ────────────────────────────────────────────────────
  social_media:               { label: 'Social Media / Community Manager', icon: '📲', capabilities: ['catalog','quotes','payments'] },
  meta_ads:                   { label: 'Meta Ads / Google Ads',         icon: '📢', capabilities: ['catalog','quotes','payments'] },
  seo_sem:                    { label: 'SEO / SEM',                     icon: '🔍', capabilities: ['catalog','quotes','payments'] },
  email_marketing:            { label: 'Email marketing',               icon: '📧', capabilities: ['catalog','quotes','payments'] },
  automatizacion_marketing:   { label: 'Automatización de marketing',   icon: '⚙️', capabilities: ['catalog','quotes','payments'] },
  marketing_publicidad:       { label: 'Agencia de marketing',          icon: '📢', capabilities: ['catalog','quotes','appointments','payments'] },

  // ── MARKETING: Publicidad y Branding ─────────────────────────────────────
  branding:                   { label: 'Branding / Identidad visual',   icon: '🎨', capabilities: ['catalog','quotes','payments'] },
  diseno_grafico:             { label: 'Diseño gráfico',                icon: '🎨', capabilities: ['catalog','quotes','payments'] },
  copywriting:                { label: 'Copywriting / Redacción',       icon: '✍️', capabilities: ['catalog','quotes','payments'] },
  produccion_audiovisual:     { label: 'Producción audiovisual',        icon: '🎬', capabilities: ['catalog','quotes','payments'] },
  fotografia_video:           { label: 'Fotografía y video',            icon: '📸', capabilities: ['catalog','appointments','quotes','payments'] },
  video_marketing:            { label: 'Video marketing / Reel',        icon: '🎥', capabilities: ['catalog','quotes','payments'] },
  influencer_marketing:       { label: 'Marketing de influencers',      icon: '⭐', capabilities: ['catalog','quotes','payments'] },

  // ── MARKETING: Medios y Comunicación ─────────────────────────────────────
  relaciones_publicas:        { label: 'Relaciones públicas',           icon: '📰', capabilities: ['catalog','quotes','payments'] },
  comunicacion_corporativa:   { label: 'Comunicación corporativa',      icon: '📡', capabilities: ['catalog','quotes','payments'] },
  locucion:                   { label: 'Locución / Voz en off',         icon: '🎙️', capabilities: ['catalog','quotes','payments'] },
  podcasts:                   { label: 'Podcasts / Audio',              icon: '🎙️', capabilities: ['catalog','quotes','payments'] },
  streaming:                  { label: 'Streaming / Producción en vivo', icon: '📡', capabilities: ['catalog','quotes','payments'] },

  // ── CONSTRUCCIÓN: Ingeniería ──────────────────────────────────────────────
  ingenieria_civil:           { label: 'Ingeniería civil',              icon: '🏗️', capabilities: ['appointments','quotes','payments'] },
  ingenieria_electrica:       { label: 'Ingeniería eléctrica',          icon: '⚡', capabilities: ['catalog','appointments','quotes','payments'] },
  ingenieria_mecanica:        { label: 'Ingeniería mecánica',           icon: '⚙️', capabilities: ['appointments','quotes','payments'] },
  ingenieria_industrial:      { label: 'Ingeniería industrial',         icon: '🏭', capabilities: ['appointments','quotes','payments'] },
  ingenieria_ambiental:       { label: 'Ingeniería ambiental',          icon: '🌿', capabilities: ['appointments','quotes','payments'] },
  ingenieria_electronica:     { label: 'Ingeniería electrónica',        icon: '🔌', capabilities: ['appointments','quotes','payments'] },
  arquitecto:                 { label: 'Arquitecto',                    icon: '📐', capabilities: ['catalog','appointments','quotes','payments'] },
  urbanismo:                  { label: 'Urbanismo / Planificación',     icon: '🏙️', capabilities: ['appointments','quotes','payments'] },
  diseno_interior:            { label: 'Diseño de interiores',          icon: '🛋️', capabilities: ['catalog','appointments','quotes','payments'] },
  ingeniero_civil:            { label: 'Consultor en ingeniería',       icon: '🏗️', capabilities: ['appointments','quotes','payments'] },

  // ── CONSTRUCCIÓN: Obra y Remodelación ─────────────────────────────────────
  remodelaciones:             { label: 'Remodelaciones y acabados',     icon: '🏠', capabilities: ['catalog','quotes','payments'] },
  obra_civil:                 { label: 'Obra civil',                    icon: '🏗️', capabilities: ['quotes','payments'] },
  interventoria:              { label: 'Interventoría',                 icon: '📋', capabilities: ['quotes','payments'] },
  topografia:                 { label: 'Topografía',                    icon: '🗺️', capabilities: ['appointments','quotes','payments'] },

  // ── EDUCACIÓN: Formal ─────────────────────────────────────────────────────
  colegio:                    { label: 'Colegio',                       icon: '🏫', capabilities: ['catalog','appointments','payments'] },
  universidad:                { label: 'Universidad / Instituto',       icon: '🎓', capabilities: ['catalog','appointments','payments'] },
  instituto_tecnico:          { label: 'Instituto técnico / SENA',      icon: '🎓', capabilities: ['catalog','appointments','payments'] },
  educacion_virtual:          { label: 'Educación virtual',             icon: '💻', capabilities: ['catalog','payments'] },
  educacion_especial:         { label: 'Educación especial',            icon: '🎓', capabilities: ['catalog','appointments','payments'] },

  // ── EDUCACIÓN: Formación Complementaria ──────────────────────────────────
  cursos_online:              { label: 'Cursos online',                 icon: '📖', capabilities: ['catalog','payments'] },
  infoproductos:              { label: 'Infoproductos',                 icon: '📦', capabilities: ['catalog','payments'] },
  coaching_mentoria:          { label: 'Coaching / Mentoría',           icon: '🎯', capabilities: ['catalog','appointments','payments'] },
  academia_idiomas:           { label: 'Academia de idiomas',           icon: '🗣️', capabilities: ['catalog','appointments','payments'] },
  tutor_clases_particulares:  { label: 'Tutor / Clases particulares',   icon: '📖', capabilities: ['catalog','appointments','payments'] },
  formacion_artistica:        { label: 'Formación artística',           icon: '🎨', capabilities: ['catalog','appointments','payments'] },
  formacion_deportiva:        { label: 'Formación deportiva',           icon: '⚽', capabilities: ['catalog','appointments','payments'] },
  servicios_educativos:       { label: 'Servicios educativos',          icon: '📚', capabilities: ['catalog','appointments','payments'] },
  escuela_danza:              { label: 'Escuela de danza',              icon: '💃', capabilities: ['catalog','appointments','payments'] },
  escuela_musica:             { label: 'Escuela de música',             icon: '🎵', capabilities: ['catalog','appointments','payments'] },

  // ── TRANSPORTE: Pasajeros y Carga ─────────────────────────────────────────
  transporte_carga:           { label: 'Transporte de carga',           icon: '🚚', capabilities: ['quotes','payments'] },
  transporte_especial:        { label: 'Transporte especial',           icon: '🚌', capabilities: ['catalog','quotes','payments'] },
  mensajeria:                 { label: 'Mensajería / Courier',          icon: '📦', capabilities: ['quotes','payments'] },
  mudanzas_trasteos:          { label: 'Mudanzas y trasteos',           icon: '📦', capabilities: ['quotes','payments'] },
  transporte_escolar:         { label: 'Transporte escolar',            icon: '🚌', capabilities: ['catalog','payments'] },
  transporte_logistica:       { label: 'Transporte y logística',        icon: '🚚', capabilities: ['quotes','payments'] },

  // ── LOGÍSTICA ─────────────────────────────────────────────────────────────
  operador_logistico:         { label: 'Operador logístico',            icon: '🏭', capabilities: ['catalog','quotes','payments'] },
  almacenamiento:             { label: 'Almacenamiento / Bodegaje',     icon: '🏗️', capabilities: ['catalog','quotes','payments'] },
  ultima_milla:               { label: 'Última milla / Delivery',       icon: '🛵', capabilities: ['quotes','payments'] },
  comercio_internacional:     { label: 'Comercio internacional',        icon: '🌐', capabilities: ['catalog','quotes','payments'] },
  aduanas:                    { label: 'Aduanas / Agente aduanero',     icon: '🛃', capabilities: ['catalog','quotes','payments'] },

  // ── COMERCIO: Físico ──────────────────────────────────────────────────────
  restaurante_comida_rapida:  { label: 'Restaurante / comida rápida',   icon: '🍔', capabilities: ['catalog','cart_orders','payments','delivery','reservations'] },
  cafeteria:                  { label: 'Cafetería',                     icon: '☕', capabilities: ['catalog','cart_orders','payments'] },
  bar:                        { label: 'Bar',                           icon: '🍸', capabilities: ['catalog','reservations','payments'] },
  panaderia_reposteria:       { label: 'Panadería y repostería',        icon: '🥐', capabilities: ['catalog','cart_orders','payments','delivery'] },
  carniceria:                 { label: 'Carnicería',                    icon: '🥩', capabilities: ['catalog','cart_orders','payments','delivery'] },
  salsamentaria:              { label: 'Salsamentaria',                 icon: '🧀', capabilities: ['catalog','cart_orders','payments','delivery'] },
  tienda_barrio:              { label: 'Tienda de barrio',              icon: '🏪', capabilities: ['catalog','cart_orders','delivery'] },
  minimercado:                { label: 'Minimercado',                   icon: '🛒', capabilities: ['catalog','cart_orders','payments','delivery'] },
  supermercado:               { label: 'Supermercado',                  icon: '🛒', capabilities: ['catalog','cart_orders','payments','delivery'] },
  licoreria:                  { label: 'Licorería',                     icon: '🍷', capabilities: ['catalog','cart_orders','payments','delivery'] },
  ropa_calzado:               { label: 'Ropa y calzado',                icon: '👗', capabilities: ['catalog','cart_orders','payments','delivery'] },
  articulos_belleza:          { label: 'Artículos de belleza',          icon: '💄', capabilities: ['catalog','cart_orders','payments','delivery'] },
  ferreteria_construccion:    { label: 'Ferretería y construcción',     icon: '🔧', capabilities: ['catalog','cart_orders','payments','delivery'] },
  papeleria_libros:           { label: 'Papelería y libros',            icon: '📝', capabilities: ['catalog','cart_orders','payments','delivery'] },
  farmacia_drogueria:         { label: 'Farmacia y droguería',          icon: '💊', capabilities: ['catalog','cart_orders','payments','delivery'] },
  electronica_informatica:    { label: 'Electrónica e informática',     icon: '💻', capabilities: ['catalog','cart_orders','payments','delivery','quotes'] },
  articulos_hogar:            { label: 'Artículos para el hogar',       icon: '🏠', capabilities: ['catalog','cart_orders','payments','delivery'] },
  articulos_deportivos:       { label: 'Artículos deportivos',          icon: '⚽', capabilities: ['catalog','cart_orders','payments','delivery'] },
  tienda_naturista:           { label: 'Tienda naturista / suplementos', icon: '🌿', capabilities: ['catalog','cart_orders','payments','delivery'] },
  accesorios_bisuteria:       { label: 'Accesorios y bisutería',        icon: '💍', capabilities: ['catalog','cart_orders','payments','delivery'] },
  tienda_regalos:             { label: 'Tienda de regalos',             icon: '🎁', capabilities: ['catalog','cart_orders','payments','delivery'] },
  articulos_automotrices:     { label: 'Artículos automotrices',        icon: '🔩', capabilities: ['catalog','cart_orders','payments','quotes'] },
  venta_automoviles:          { label: 'Venta de automóviles',          icon: '🚗', capabilities: ['catalog','quotes','appointments','payments'] },
  insumos_agropecuarios:      { label: 'Insumos agropecuarios',         icon: '🌾', capabilities: ['catalog','cart_orders','payments','delivery','quotes'] },
  distribuidora_mayorista:    { label: 'Distribuidora / Mayorista',     icon: '📦', capabilities: ['catalog','cart_orders','payments','delivery','quotes'] },
  industria_manufactura:      { label: 'Industria / manufactura',       icon: '🏭', capabilities: ['catalog','quotes','payments'] },

  // ── COMERCIO: Digital ─────────────────────────────────────────────────────
  ecommerce:                  { label: 'E-commerce',                    icon: '🛒', capabilities: ['catalog','cart_orders','payments','delivery'] },
  dropshipping:               { label: 'Dropshipping',                  icon: '📦', capabilities: ['catalog','cart_orders','payments','delivery'] },
  marketplace:                { label: 'Marketplace',                   icon: '🏪', capabilities: ['catalog','cart_orders','payments','delivery'] },
  venta_catalogo:             { label: 'Venta por catálogo',            icon: '📋', capabilities: ['catalog','cart_orders','payments','delivery'] },
  afiliados_digitales:        { label: 'Afiliados digitales',           icon: '🔗', capabilities: ['catalog','payments'] },

  // ── TURISMO ────────────────────────────────────────────────────────────────
  hoteles_turismo:            { label: 'Hotel',                         icon: '🏨', capabilities: ['catalog','reservations','payments'] },
  hostal:                     { label: 'Hostal / Posada',               icon: '🏡', capabilities: ['catalog','reservations','payments'] },
  agencia_viajes:             { label: 'Agencia de viajes',             icon: '✈️', capabilities: ['catalog','quotes','reservations','payments'] },
  guia_turistico:             { label: 'Guía turístico',                icon: '🗺️', capabilities: ['catalog','appointments','payments'] },
  turismo_ecologico:          { label: 'Turismo ecológico / aventura',  icon: '🌿', capabilities: ['catalog','reservations','payments'] },
  turismo_medico:             { label: 'Turismo médico',                icon: '🏥', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── ENTRETENIMIENTO ────────────────────────────────────────────────────────
  discoteca:                  { label: 'Discoteca / Club',              icon: '🎉', capabilities: ['catalog','reservations','payments'] },
  entretenimiento_ocio:       { label: 'Entretenimiento y ocio',        icon: '🎮', capabilities: ['catalog','reservations','payments'] },
  organizacion_eventos:       { label: 'Organización de eventos',       icon: '🎉', capabilities: ['catalog','quotes','reservations','payments'] },
  productora_eventos:         { label: 'Productora / Shows',            icon: '🎬', capabilities: ['catalog','quotes','payments'] },

  // ── BELLEZA Y BIENESTAR ────────────────────────────────────────────────────
  salon_belleza_barberia:     { label: 'Salón de belleza / Barbería',   icon: '💇', capabilities: ['catalog','appointments','payments'] },
  estetica_salud:             { label: 'Estética y salud',              icon: '💆', capabilities: ['catalog','appointments','payments'] },
  spa_bienestar:              { label: 'Spa y bienestar',               icon: '🧖', capabilities: ['catalog','appointments','reservations','payments'] },
  tatuajes_piercings:         { label: 'Tatuajes y piercings',          icon: '🎨', capabilities: ['catalog','appointments','payments'] },
  gimnasio:                   { label: 'Gimnasio',                      icon: '🏋️', capabilities: ['catalog','appointments','payments'] },

  // ── SERVICIOS TÉCNICOS Y MANTENIMIENTO ────────────────────────────────────
  electricista:               { label: 'Electricista',                  icon: '⚡', capabilities: ['catalog','appointments','quotes','payments'] },
  plomeria:                   { label: 'Plomería',                      icon: '🔧', capabilities: ['appointments','quotes','payments'] },
  refrigeracion:              { label: 'Refrigeración / Aire acondicionado', icon: '❄️', capabilities: ['catalog','appointments','quotes','payments'] },
  soldadura:                  { label: 'Soldadura / Metalmecánica',     icon: '🔩', capabilities: ['catalog','quotes','payments'] },
  mecanica_automotriz:        { label: 'Mecánica automotriz',           icon: '🔧', capabilities: ['catalog','appointments','quotes','payments'] },
  taller_automotriz:          { label: 'Taller automotriz',             icon: '🔧', capabilities: ['appointments','quotes','payments'] },
  mantenimiento_industrial:   { label: 'Mantenimiento industrial',      icon: '⚙️', capabilities: ['catalog','quotes','payments'] },
  automatizacion_industrial:  { label: 'Automatización industrial',     icon: '🏭', capabilities: ['catalog','quotes','payments'] },
  reparaciones_mantenimiento: { label: 'Reparaciones y mantenimiento',  icon: '🔧', capabilities: ['appointments','quotes','payments'] },
  cerrajeria:                 { label: 'Cerrajería',                    icon: '🔑', capabilities: ['catalog','appointments','quotes','payments'] },
  fumigacion_plagas:          { label: 'Fumigación / Control de plagas', icon: '🐛', capabilities: ['catalog','appointments','quotes','payments'] },
  aseo_limpieza:              { label: 'Aseo y limpieza',               icon: '🧹', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── SERVICIOS FINANCIEROS ─────────────────────────────────────────────────
  fintech:                    { label: 'Fintech',                       icon: '💳', capabilities: ['catalog','payments'] },
  cooperativa:                { label: 'Cooperativa / Ahorro y crédito', icon: '🏦', capabilities: ['catalog','appointments','payments'] },
  microcredito:               { label: 'Microcrédito',                  icon: '💰', capabilities: ['catalog','appointments','quotes'] },
  casa_cambio:                { label: 'Casa de cambio',                icon: '💱', capabilities: ['catalog','payments'] },
  corredor_seguros:           { label: 'Corredor de seguros',           icon: '🛡️', capabilities: ['catalog','appointments','quotes','payments'] },
  agente_seguros:             { label: 'Agente de seguros',             icon: '🛡️', capabilities: ['catalog','appointments','quotes','payments'] },
  prestamos_financiamiento:   { label: 'Préstamos y financiamiento',    icon: '💰', capabilities: ['appointments','quotes'] },
  trading:                    { label: 'Trading / Inversiones',         icon: '📈', capabilities: ['catalog','appointments','payments'] },
  criptoactivos:              { label: 'Criptoactivos / Blockchain',    icon: '₿',  capabilities: ['catalog','payments'] },

  // ── INMOBILIARIO ──────────────────────────────────────────────────────────
  agente_inmobiliario:        { label: 'Inmobiliaria / Bienes raíces',  icon: '🏡', capabilities: ['catalog','appointments','quotes','payments'] },
  avaluos:                    { label: 'Avalúos',                       icon: '🏠', capabilities: ['catalog','appointments','quotes','payments'] },
  propiedad_horizontal:       { label: 'Administración propiedad horizontal', icon: '🏢', capabilities: ['catalog','appointments','payments'] },
  leasing_inmobiliario:       { label: 'Leasing inmobiliario',          icon: '🏗️', capabilities: ['catalog','appointments','quotes','payments'] },

  // ── CREATIVOS Y ARTE ──────────────────────────────────────────────────────
  diseno_ux_ui:               { label: 'Diseño UX/UI',                  icon: '🖥️', capabilities: ['catalog','quotes','payments'] },
  ilustracion:                { label: 'Ilustración',                   icon: '🎨', capabilities: ['catalog','quotes','payments'] },
  animacion_3d:               { label: 'Animación 3D / Motion',         icon: '🎬', capabilities: ['catalog','quotes','payments'] },
  produccion_musical:         { label: 'Producción musical',            icon: '🎵', capabilities: ['catalog','appointments','quotes','payments'] },
  artes_plasticas:            { label: 'Artes plásticas',               icon: '🎨', capabilities: ['catalog','payments'] },
  artesanias:                 { label: 'Artesanías',                    icon: '🪆', capabilities: ['catalog','cart_orders','payments','delivery'] },
  diseno_industrial:          { label: 'Diseño industrial',             icon: '⚙️', capabilities: ['catalog','quotes','payments'] },
  moda:                       { label: 'Moda / Diseño de ropa',         icon: '👗', capabilities: ['catalog','cart_orders','payments','delivery'] },
  traductor_interprete:       { label: 'Traductor / Intérprete',        icon: '🌐', capabilities: ['catalog','quotes','payments'] },

  // ── AGROINDUSTRIA ─────────────────────────────────────────────────────────
  agricultura:                { label: 'Agricultura',                   icon: '🌾', capabilities: ['catalog','cart_orders','payments','delivery'] },
  ganaderia:                  { label: 'Ganadería',                     icon: '🐄', capabilities: ['catalog','quotes','payments'] },
  piscicultura:               { label: 'Piscicultura / Acuicultura',    icon: '🐟', capabilities: ['catalog','cart_orders','payments','delivery'] },
  avicultura:                 { label: 'Avicultura',                    icon: '🐔', capabilities: ['catalog','cart_orders','payments','delivery'] },
  agroexportacion:            { label: 'Agroexportación',               icon: '🌐', capabilities: ['catalog','quotes','payments'] },
  produccion_organica:        { label: 'Producción orgánica',           icon: '🌿', capabilities: ['catalog','cart_orders','payments','delivery'] },
  asistencia_tecnica_rural:   { label: 'Asistencia técnica rural',      icon: '🌾', capabilities: ['catalog','appointments','quotes','payments'] },
  maquinaria_agricola:        { label: 'Maquinaria agrícola',           icon: '🚜', capabilities: ['catalog','quotes','payments'] },

  // ── SEGURIDAD ─────────────────────────────────────────────────────────────
  vigilancia_privada:         { label: 'Vigilancia privada',            icon: '🛡️', capabilities: ['catalog','quotes','payments'] },
  escoltas:                   { label: 'Escoltas',                      icon: '🛡️', capabilities: ['catalog','quotes','payments'] },
  cctv_alarmas:               { label: 'CCTV / Alarmas / Control acceso', icon: '📹', capabilities: ['catalog','appointments','quotes','payments'] },
  pentesting:                 { label: 'Pentesting / Ethical Hacking',  icon: '🔓', capabilities: ['catalog','quotes','payments'] },

  // ── SOCIAL Y RELIGIOSO ────────────────────────────────────────────────────
  ong_fundacion:              { label: 'ONG / Fundación',               icon: '🤝', capabilities: ['catalog','payments'] },
  asociacion:                 { label: 'Asociación / Gremio',           icon: '🤝', capabilities: ['catalog','appointments','payments'] },
  iglesia:                    { label: 'Iglesia / Comunidad religiosa', icon: '⛪', capabilities: ['catalog','payments'] },

  // ── ECONOMÍA DIGITAL ──────────────────────────────────────────────────────
  creador_contenido:          { label: 'Creador de contenido',          icon: '🎥', capabilities: ['catalog','payments'] },
  streamer:                   { label: 'Streamer',                      icon: '🎮', capabilities: ['catalog','payments'] },
  influencer:                 { label: 'Influencer',                    icon: '⭐', capabilities: ['catalog','quotes','payments'] },
  diseno_grafico_freelance:   { label: 'Diseñador / Freelancer',        icon: '🎨', capabilities: ['catalog','quotes','payments'] },

  // ── OTRO ──────────────────────────────────────────────────────────────────
  otro:                       { label: 'Otro',                          icon: '🏢', capabilities: ['catalog','payments'] },

} as const satisfies Record<string, BusinessTypeConfig>;

export type BusinessType = keyof typeof BUSINESS_TYPES;
