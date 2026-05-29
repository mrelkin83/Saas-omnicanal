import { registerMCPServer } from './core/mcp-registry.js';
import { catalogMCPServer } from './servers/catalog-mcp-server.js';
import { appointmentsMCPServer } from './servers/appointments-mcp-server.js';
import { ordersMCPServer } from './servers/orders-mcp-server.js';
import { paymentsMCPServer } from './servers/payments-mcp-server.js';
import { quotesMCPServer } from './servers/quotes-mcp-server.js';
import { reservationsMCPServer } from './servers/reservations-mcp-server.js';
import { knowledgeMCPServer } from './servers/knowledge-mcp-server.js';
import { customerMCPServer } from './servers/customer-mcp-server.js';

export function registerAllMCPServers(): void {
  registerMCPServer(catalogMCPServer);
  registerMCPServer(appointmentsMCPServer);
  registerMCPServer(ordersMCPServer);
  registerMCPServer(paymentsMCPServer);
  registerMCPServer(quotesMCPServer);
  registerMCPServer(reservationsMCPServer);
  registerMCPServer(knowledgeMCPServer);
  registerMCPServer(customerMCPServer);
}

export * from './core/mcp-server.interface.js';
export * from './core/mcp-registry.js';
export * from './core/mcp-client.js';
