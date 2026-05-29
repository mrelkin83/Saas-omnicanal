import type { Tenant } from '@saas/db';
import type { ChannelType } from '../channels/core/channel-driver.interface.js';
import { buildChannelPromptSection } from '../channels/core/channel-prompt-adapter.js';
import type { MCPServer } from '../../mcp/core/mcp-server.interface.js';

const TONE_INSTRUCTIONS: Record<string, string> = {
  amigable: 'Sé cálido, cercano y usa emojis con moderación.',
  profesional: 'Mantén un tono profesional y conciso.',
  formal: 'Usa lenguaje formal y respetuoso.',
  casual: 'Sé casual, relajado y usa jerga colombiana cuando sea apropiado.',
};

export interface BuildSystemPromptParams {
  tenant: Tenant;
  channel: ChannelType;
  capabilities: string[];
  knowledgeContext: string;
  dynamicContext: string;
  currentDateTime: string;
  mcpServers: MCPServer[];
}

export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const { tenant, channel, knowledgeContext, dynamicContext, currentDateTime, mcpServers } = params;

  const toneInstruction = TONE_INSTRUCTIONS[tenant.aiTone ?? 'amigable'] ?? TONE_INSTRUCTIONS['amigable']!;

  const sections: string[] = [
    `Eres ${tenant.aiAgentName ?? 'Asistente'}, el asistente virtual de ${tenant.name}. ${toneInstruction}`,
    `Responde SIEMPRE en español colombiano. Sé conciso y útil.`,
    ``,
    `FECHA Y HORA ACTUAL: ${currentDateTime} (zona horaria: ${tenant.timezone ?? 'America/Bogota'})`,
    ``,
    `INFORMACIÓN DEL NEGOCIO:`,
    `- Nombre: ${tenant.name}`,
    tenant.description ? `- Descripción: ${tenant.description}` : '',
    tenant.phone ? `- Teléfono: ${tenant.phone}` : '',
    tenant.address ? `- Dirección: ${tenant.address}` : '',
    ``,
    buildChannelPromptSection(channel),
  ];

  if (knowledgeContext) {
    sections.push('', 'BASE DE CONOCIMIENTO:', knowledgeContext);
  }

  if (dynamicContext) {
    sections.push('', 'CONTEXTO DEL CLIENTE:', dynamicContext);
  }

  // MCP Tools section — the LLM can invoke any tool from available MCP servers
  if (mcpServers.length > 0) {
    sections.push(
      '',
      '═══════════════════════════════════════════════════════════════',
      'HERRAMIENTAS DISPONIBLES (TOOLS):',
      '═══════════════════════════════════════════════════════════════',
      'Tienes acceso a las siguientes herramientas para ayudar al cliente.',
      'Cuando necesites usar una herramienta, responde SOLO con un JSON de invocación:',
      '{"tool": "nombre_herramienta", "params": {...}}',
      '',
      'Puedes invocar múltiples herramientas en secuencia si es necesario.',
      'Después de recibir el resultado de una herramienta, formatea la respuesta',
      'de forma natural para el cliente según las REGLAS DEL CANAL.',
      '',
    );

    for (const server of mcpServers) {
      sections.push(`--- ${server.name} ---`);
      sections.push(server.description);
      for (const tool of server.tools) {
        const paramDesc = Object.entries(tool.parameters.shape)
          .map(([k, v]) => {
            const isOpt = (v as { isOptional?: () => boolean }).isOptional?.() ?? false;
            return `${k}${isOpt ? '?' : ''}: ${(v as { description?: string }).description || 'string'}`;
          })
          .join(', ');
        sections.push(`  • ${tool.name}(${paramDesc}) — ${tool.description}`);
      }
      sections.push('');
    }
  }

  sections.push(
    '',
    '═══════════════════════════════════════════════════════════════',
    'INSTRUCCIONES FINALES:',
    '═══════════════════════════════════════════════════════════════',
    '- Si el cliente quiere información general del negocio, responde directamente.',
    '- Si el cliente quiere realizar una acción (agendar, comprar, pagar, etc.),',
    '  invoca la herramienta correspondiente con {"tool": "...", "params": {...}}.',
    '- Si no tienes una herramienta para lo que pide el cliente, indícalo amablemente.',
    '- Si el cliente pide hablar con un humano, invoca {"tool": "escalamiento", "params": {"motivo": "..."}}.',
    '- NUNCA inventes información que no tengas en el contexto o las herramientas.',
    '- Respeta SIEMPRE las REGLAS DEL CANAL para formatear tu respuesta.',
  );

  return sections.filter((s) => s !== undefined && s !== '').join('\n');
}
