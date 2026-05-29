import type {
  ChannelType,
  OutgoingMessage,
  TextMessage,
  ButtonMessage,
  ListMessage,
  QuickReplyMessage,
  ButtonOption,
} from './channel-driver.interface.js';
import { getChannelRules } from './channel-prompt-adapter.js';

interface ParsedOptions {
  title: string;
  options: string[];
}

/**
 * Detecta si un texto contiene opciones listadas (1. 2. 3. o - bullet)
 */
function parseOptions(text: string): ParsedOptions | null {
  // Pattern: "Título:\n1. Opción A\n2. Opción B" or "1) Opción A"
  const numberedMatch = text.match(/(?:^(.*?)\n)?((?:^\s*(?:\d+[\.\)\-]\s+|[-•]\s+).*(?:\n|$))+)/m);
  if (!numberedMatch) return null;

  const lines = numberedMatch[2].split('\n').filter(Boolean);
  const options = lines
    .map((l) => l.replace(/^\s*(?:\d+[\.\)\-]\s+|[-•]\s+)/, '').trim())
    .filter(Boolean);

  if (options.length < 2) return null;

  const title = (numberedMatch[1] ?? '').trim() || 'Opciones';
  return { title, options };
}

/**
 * Trunca texto al límite del canal
 */
function truncate(text: string, channel: ChannelType): string {
  const max = getChannelRules(channel).maxChars;
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

/**
 * Formatea opciones para texto plano según el canal
 */
function formatOptionsAsText(options: string[], channel: ChannelType): string {
  if (channel === 'instagram') {
    return options.map((o, i) => `${['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i] ?? `${i + 1}.`} ${o}`).join('\n');
  }
  if (channel === 'tiktok') {
    return options.map((o) => `- ${o}`).join('\n');
  }
  return options.map((o, i) => `${i + 1}. ${o}`).join('\n');
}

function createButtonOptions(options: string[]): ButtonOption[] {
  return options.map((o, i) => ({
    id: `opt_${i}`,
    title: o.length > 20 ? o.slice(0, 17) + '...' : o,
    ...(o.length > 20 ? { description: o } : {}),
  }));
}

/**
 * Transforma una respuesta del motor al mejor formato para el canal destino.
 * Detecta automáticamente si el texto contiene opciones y las convierte
 * al formato interactivo apropiado (botones, listas, quick replies).
 */
export function formatMessageForChannel(
  text: string,
  channel: ChannelType,
): OutgoingMessage {
  const rules = getChannelRules(channel);
  const parsed = parseOptions(text);

  // Si no hay opciones o el canal no soporta interactividad → texto plano
  if (!parsed || (!rules.supportsButtons && !rules.supportsLists && !rules.supportsQuickReplies)) {
    return {
      type: 'text',
      text: truncate(text, channel),
    } as TextMessage;
  }

  const { title, options } = parsed;
  const bodyText = text.replace(/(?:^(.*?)\n)?((?:^\s*(?:\d+[\.\)\-]\s+|[-•]\s+).*(?:\n|$))+)/m, '').trim();
  const body = bodyText || title;

  // WhatsApp: usar botones (≤3) o lista (>3)
  if (channel === 'whatsapp') {
    if (options.length <= rules.maxButtons && rules.supportsButtons) {
      return {
        type: 'button',
        body: truncate(body, channel),
        buttons: createButtonOptions(options),
      } as ButtonMessage;
    }
    if (rules.supportsLists && options.length <= rules.maxListOptions) {
      return {
        type: 'list',
        body: truncate(body, channel),
        buttonText: 'Ver opciones',
        sections: [{ title: 'Opciones disponibles', rows: createButtonOptions(options) }],
      } as ListMessage;
    }
  }

  // Facebook: usar quick replies (≤11) o botones (≤3)
  if (channel === 'facebook') {
    if (options.length <= rules.maxQuickReplies && rules.supportsQuickReplies) {
      return {
        type: 'quick_reply',
        text: truncate(body, channel),
        options: options.map((o, i) => ({
          id: `qr_${i}`,
          title: o.length > 20 ? o.slice(0, 17) + '...' : o,
        })),
      } as QuickReplyMessage;
    }
    if (options.length <= rules.maxButtons && rules.supportsButtons) {
      return {
        type: 'button',
        body: truncate(body, channel),
        buttons: createButtonOptions(options),
      } as ButtonMessage;
    }
  }

  // Instagram / TikTok / fallback: texto plano con opciones formateadas
  const formattedOptions = formatOptionsAsText(options, channel);
  const fullText = body ? `${body}\n\n${formattedOptions}` : formattedOptions;
  return {
    type: 'text',
    text: truncate(fullText, channel),
  } as TextMessage;
}

/**
 * Crea un mensaje de texto plano para cualquier canal
 */
export function textMessage(text: string, channel: ChannelType): TextMessage {
  return {
    type: 'text',
    text: truncate(text, channel),
  };
}

/**
 * Crea un mensaje con botones (si el canal lo soporta, sino texto)
 */
export function buttonMessage(
  body: string,
  buttons: ButtonOption[],
  channel: ChannelType,
): OutgoingMessage {
  const rules = getChannelRules(channel);
  if (rules.supportsButtons && buttons.length <= rules.maxButtons) {
    return { type: 'button', body: truncate(body, channel), buttons } as ButtonMessage;
  }
  // Fallback a texto con opciones numeradas
  const opts = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
  return textMessage(`${body}\n\n${opts}`, channel);
}

/**
 * Crea un mensaje con lista (si el canal lo soporta, sino texto)
 */
export function listMessage(
  body: string,
  sections: { title: string; rows: ButtonOption[] }[],
  channel: ChannelType,
): OutgoingMessage {
  const rules = getChannelRules(channel);
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  if (rules.supportsLists && totalRows <= rules.maxListOptions) {
    return {
      type: 'list',
      body: truncate(body, channel),
      buttonText: 'Ver opciones',
      sections,
    } as ListMessage;
  }
  // Fallback a texto
  const lines = sections.flatMap((s) => [s.title, ...s.rows.map((r, i) => `${i + 1}. ${r.title}`)]);
  return textMessage(`${body}\n\n${lines.join('\n')}`, channel);
}
