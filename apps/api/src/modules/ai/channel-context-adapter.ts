import type { ChannelType } from '../channels/core/channel-driver.interface.js';

interface ChannelContextRules {
  maxSections: number;
  excludedPrefixes: string[];
  maxLinesPerSection: number;
  summarize: boolean;
}

const RULES: Record<ChannelType, ChannelContextRules> = {
  whatsapp: {
    maxSections: 10,
    excludedPrefixes: [],
    maxLinesPerSection: 10,
    summarize: false,
  },
  facebook: {
    maxSections: 8,
    excludedPrefixes: [],
    maxLinesPerSection: 6,
    summarize: true,
  },
  instagram: {
    maxSections: 5,
    excludedPrefixes: ['COTIZACIONES'],
    maxLinesPerSection: 4,
    summarize: true,
  },
  tiktok: {
    maxSections: 3,
    excludedPrefixes: ['COTIZACIONES', 'RESERVAS', 'CITAS'],
    maxLinesPerSection: 3,
    summarize: true,
  },
};

function summarizeSection(lines: string[], maxLines: number): string {
  if (lines.length <= maxLines) return lines.join('\n');
  const kept = lines.slice(0, maxLines);
  const omitted = lines.length - maxLines;
  return `${kept.join('\n')}\n  ...y ${omitted} más`;
}

/**
 * Adapta el contexto dinámico del cliente según el canal de comunicación.
 * - WhatsApp: contexto completo (hasta 10 secciones, 10 líneas cada una)
 * - Facebook: completo pero resumido (máx 6 líneas por sección)
 * - Instagram: omite cotizaciones, máx 4 líneas por sección
 * - TikTok: solo perfil + carrito + pedidos, máx 3 líneas por sección
 */
export function adaptContextForChannel(rawContext: string, channel: ChannelType): string {
  if (!rawContext.trim()) return '';

  const rules = RULES[channel];

  // Split into sections by double newline
  const sections = rawContext.split(/\n\n+/).filter(Boolean);

  const filtered = sections
    .filter((section) => {
      const firstLine = section.split('\n')[0] ?? '';
      return !rules.excludedPrefixes.some((prefix) => firstLine.includes(prefix));
    })
    .slice(0, rules.maxSections)
    .map((section) => {
      const lines = section.split('\n');
      const header = lines[0] ?? '';
      const body = lines.slice(1);

      if (body.length === 0) return header;

      const trimmedBody = rules.summarize ? summarizeSection(body, rules.maxLinesPerSection) : body.join('\n');
      return `${header}\n${trimmedBody}`;
    });

  return filtered.join('\n\n');
}
