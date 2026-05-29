import type { MCPServer } from './mcp-server.interface.js';

const registry = new Map<string, MCPServer>();

export function registerMCPServer(server: MCPServer): void {
  registry.set(server.name, server);
}

export function getMCPServer(name: string): MCPServer | undefined {
  return registry.get(name);
}

export function getAllMCPServers(): MCPServer[] {
  return Array.from(registry.values());
}

export function getMCPServersForCapabilities(capabilities: string[]): MCPServer[] {
  return Array.from(registry.values()).filter((server) => {
    // If no capabilities are specified, all servers are available.
    if (capabilities.length === 0) return true;
    // Servers with no required capabilities are always available.
    if (server.capabilities.length === 0) return true;
    return server.capabilities.some((cap) => capabilities.includes(cap));
  });
}
