import type { ChannelType } from './channel-driver.interface.js';

export interface ChannelRules {
  name: string;
  supportsButtons: boolean;
  maxButtons: number;
  supportsLists: boolean;
  maxListOptions: number;
  supportsQuickReplies: boolean;
  maxQuickReplies: number;
  supportsMedia: boolean;
  supportsTemplates: boolean;
  supportsFormatting: boolean; // bold, italic, strikethrough
  maxChars: number;
  toneHint: string;
  optionFormat: 'numbered' | 'bullets' | 'interactive';
  instructions: string[];
}

const CHANNEL_RULES: Record<ChannelType, ChannelRules> = {
  whatsapp: {
    name: 'WhatsApp',
    supportsButtons: true,
    maxButtons: 3,
    supportsLists: true,
    maxListOptions: 10,
    supportsQuickReplies: false,
    maxQuickReplies: 0,
    supportsMedia: true,
    supportsTemplates: true,
    supportsFormatting: true,
    maxChars: 4096,
    toneHint: 'profesional pero cercano, usa emojis con moderación',
    optionFormat: 'interactive',
    instructions: [
      'Puedes usar mensajes interactivos: BOTONES (máximo 3) y LISTAS (máximo 10 opciones).',
      'Cuando ofrezcas opciones al cliente, usa el formato de LISTA INTERACTIVA si son más de 3, o BOTONES si son 3 o menos.',
      'Para formatear texto: *negrita*, _cursiva_, ~tachado~.',
      'Máximo 4096 caracteres por mensaje.',
      'Si necesitas enviar una ubicación, indícalo claramente.',
      'Soportas imágenes, videos, audios y documentos.',
    ],
  },

  instagram: {
    name: 'Instagram DM',
    supportsButtons: false,
    maxButtons: 0,
    supportsLists: false,
    maxListOptions: 0,
    supportsQuickReplies: false,
    maxQuickReplies: 0,
    supportsMedia: true, // images/videos shared
    supportsTemplates: false,
    supportsFormatting: false,
    maxChars: 1000,
    toneHint: 'conversacional, cercano y casual (el tono de IG es muy relajado)',
    optionFormat: 'numbered',
    instructions: [
      'Solo texto y emojis. NO uses botones, listas, ni quick replies — Instagram DM no los soporta.',
      'Para presentar opciones, usa números seguidos de emoji: "1️⃣ Opción A\n2️⃣ Opción B".',
      'Sé conversacional y cercano. El tono de Instagram es más casual que WhatsApp.',
      'Máximo 1000 caracteres por mensaje.',
      'Evita links largos; usa acortadores si es necesario.',
      'Puedes compartir imágenes y videos.',
    ],
  },

  facebook: {
    name: 'Facebook Messenger',
    supportsButtons: true,
    maxButtons: 3,
    supportsLists: false,
    maxListOptions: 0,
    supportsQuickReplies: true,
    maxQuickReplies: 11,
    supportsMedia: true,
    supportsTemplates: true,
    supportsFormatting: false,
    maxChars: 2000,
    toneHint: 'amigable y servicial',
    optionFormat: 'interactive',
    instructions: [
      'Puedes usar QUICK REPLIES (máximo 11 opciones con emoji + texto corto).',
      'Puedes usar BOTONES con URL o payload (máximo 3 por mensaje).',
      'Soportas plantillas genéricas con imagen y botones.',
      'Máximo 2000 caracteres por mensaje.',
      'Puedes compartir imágenes, videos y ubicaciones.',
    ],
  },

  tiktok: {
    name: 'TikTok',
    supportsButtons: false,
    maxButtons: 0,
    supportsLists: false,
    maxListOptions: 0,
    supportsQuickReplies: false,
    maxQuickReplies: 0,
    supportsMedia: false,
    supportsTemplates: false,
    supportsFormatting: false,
    maxChars: 200,
    toneHint: 'joven, casual, usa jerga colombiana cuando sea apropiado',
    optionFormat: 'bullets',
    instructions: [
      'Solo texto plano. Sin emojis complejos, sin botones, sin listas.',
      'Sé EXTREMADAMENTE conciso. Máximo 200 caracteres por mensaje.',
      'El tono debe ser joven, casual, con jerga colombiana apropiada.',
      'Para opciones, usa viñetas simples: "- opción A\n- opción B".',
      'No compartas links largos ni imágenes.',
    ],
  },
};

export function getChannelRules(channel: ChannelType): ChannelRules {
  return CHANNEL_RULES[channel];
}

export function buildChannelPromptSection(channel: ChannelType): string {
  const rules = CHANNEL_RULES[channel];
  const lines = [
    `CANAL: ${rules.name}`,
    `TONO: ${rules.toneHint}`,
    `LÍMITE DE CARACTERES: ${rules.maxChars}`,
    '',
    'REGLAS DEL CANAL:',
    ...rules.instructions.map((i) => `- ${i}`),
  ];
  return lines.join('\n');
}
