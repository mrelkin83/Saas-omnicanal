import type { z } from 'zod';

export interface MCPToolContext {
  tenantId: string;
  customerId: string;
  channel: string;
  conversationId: string | null;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: z.ZodObject<Record<string, z.ZodTypeAny>>;
  execute: (params: Record<string, unknown>, context: MCPToolContext) => Promise<string>;
}

export interface MCPServer {
  name: string;
  description: string;
  capabilities: string[]; // which tenant capabilities this server requires
  tools: MCPTool[];
}
