import type { MCPServer, MCPTool, MCPToolContext } from './mcp-server.interface.js';
import { getAllMCPServers } from './mcp-registry.js';

interface ToolInvocation {
  tool: string;
  params: Record<string, unknown>;
}

/**
 * Parsea una invocación de herramienta desde la respuesta del LLM.
 * Soporta múltiples formatos:
 * - {"tool": "nombre", "params": {...}}
 * - {"accion": "nombre", "params": {...}} (legacy)
 */
export function parseToolInvocation(text: string): ToolInvocation | null {
  const patterns = [
    /\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*(\{[\s\S]*?\})\s*\}/,
    /\{\s*"accion"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*(\{[\s\S]*?\})\s*\}/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const toolName = match[1]!;
        const params = JSON.parse(match[2]!);
        return { tool: toolName, params };
      } catch {
        // invalid JSON, try next
      }
    }
  }

  // Try to parse the entire response as JSON
  try {
    const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
    if (typeof parsed.tool === 'string') {
      return { tool: parsed.tool, params: (parsed.params as Record<string, unknown>) ?? {} };
    }
    if (typeof parsed.accion === 'string') {
      return { tool: parsed.accion, params: (parsed.params as Record<string, unknown>) ?? {} };
    }
  } catch {
    // not JSON
  }

  return null;
}

function findTool(toolName: string): { server: MCPServer; tool: MCPTool } | null {
  const servers = getAllMCPServers();
  for (const server of servers) {
    const tool = server.tools.find((t) => t.name === toolName);
    if (tool) return { server, tool };
  }
  return null;
}

export interface MCPExecuteResult {
  success: boolean;
  result: string;
  toolName: string | null;
}

/**
 * Ejecuta una herramienta MCP si la respuesta del LLM contiene una invocación.
 * Si no hay invocación, retorna null.
 */
export async function executeToolFromResponse(
  llmResponse: string,
  context: MCPToolContext,
): Promise<MCPExecuteResult | null> {
  const invocation = parseToolInvocation(llmResponse);
  if (!invocation) return null;

  const found = findTool(invocation.tool);
  if (!found) {
    return {
      success: false,
      result: `La herramienta "${invocation.tool}" no está disponible.`,
      toolName: invocation.tool,
    };
  }

  try {
    // Validate params with Zod
    const parseResult = found.tool.parameters.safeParse(invocation.params);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        result: `Parámetros inválidos para ${invocation.tool}: ${errors}`,
        toolName: invocation.tool,
      };
    }

    const result = await found.tool.execute(parseResult.data, context);
    return { success: true, result, toolName: invocation.tool };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      result: `Error ejecutando ${invocation.tool}: ${message}`,
      toolName: invocation.tool,
    };
  }
}

/**
 * Ejecuta múltiples herramientas en secuencia y devuelve los resultados acumulados.
 * Útil cuando el LLM necesita encadenar operaciones.
 */
export async function executeToolChain(
  llmResponse: string,
  context: MCPToolContext,
): Promise<MCPExecuteResult[]> {
  const results: MCPExecuteResult[] = [];
  let currentText = llmResponse;

  // Try to find multiple tool invocations in the response
  const toolPattern = /\{\s*"(?:tool|accion)"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
  let match: RegExpExecArray | null;

  while ((match = toolPattern.exec(currentText)) !== null) {
    try {
      const toolName = match[1]!;
      const params = JSON.parse(match[2]!);
      const found = findTool(toolName);

      if (!found) {
        results.push({
          success: false,
          result: `Herramienta "${toolName}" no disponible.`,
          toolName,
        });
        continue;
      }

      const parseResult = found.tool.parameters.safeParse(params);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        results.push({
          success: false,
          result: `Parámetros inválidos: ${errors}`,
          toolName,
        });
        continue;
      }

      const result = await found.tool.execute(parseResult.data, context);
      results.push({ success: true, result, toolName });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        success: false,
        result: `Error: ${message}`,
        toolName: match[1] ?? null,
      });
    }
  }

  // If no chained tools found, try single invocation
  if (results.length === 0) {
    const single = await executeToolFromResponse(currentText, context);
    if (single) results.push(single);
  }

  return results;
}
