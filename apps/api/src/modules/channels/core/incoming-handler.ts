import type { NormalizedMessage } from './channel-driver.interface.js';
import { db, tenants, channelSessions, conversations, conversationState, eq, and } from '@saas/db';
import { findOrCreateCustomer, findOrCreateConversation, saveInboundMessage, saveOutboundMessage } from '../../conversations/conversations.messaging.js';
import { runAIEngine } from '../../ai/ai.engine.js';
import { sendMessage } from './channel-manager.js';
import { pushInboxEvent } from '../../conversations/inbox.sse.js';
import { assignRoundRobin } from './round-robin.js';

export async function handleIncomingMessage(msg: NormalizedMessage): Promise<void> {
  const { tenantId, channel, from, text, externalId } = msg;

  // Find tenant
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) return;

  // Find channel session ID
  const [session] = await db
    .select({ id: channelSessions.id })
    .from(channelSessions)
    .where(and(eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, channel)));

  const customer = await findOrCreateCustomer(tenantId, from);
  const conversation = await findOrCreateConversation(tenantId, customer.id, channel, session?.id ?? null);

  // Auto-assign to available agent if not yet assigned
  if (!conversation.assignedUserId) {
    const agentId = await assignRoundRobin(tenantId);
    if (agentId) {
      await db.update(conversations).set({ assignedUserId: agentId, updatedAt: new Date() }).where(eq(conversations.id, conversation.id));
    }
  }

  const inbound = await saveInboundMessage(tenantId, conversation.id, customer.id, text, externalId);

  // Push to inbox SSE
  pushInboxEvent(tenantId, 'message', {
    conversationId: conversation.id,
    message: inbound,
    customer: { id: customer.id, displayName: customer.displayName ?? from, phone: customer.phone },
  });

  // Check if AI is paused for this conversation (state = 'AGENTE_ACTIVO')
  const [state] = await db
    .select({ state: conversationState.state })
    .from(conversationState)
    .where(and(eq(conversationState.tenantId, tenantId), eq(conversationState.customerId, customer.id), eq(conversationState.channel, channel)));

  if (state?.state === 'AGENTE_ACTIVO') return;

  // Run AI engine
  const result = await runAIEngine(tenant, customer.id, text, channel, conversation.id);

  // Send response via channel (from = reply-to address: phone for WA, threadId for IG, threadID for FB)
  try {
    await sendMessage(tenantId, channel, msg.from, { type: 'text', text: result.response });
  } catch {
    // Channel might not be able to send (TikTok, etc.) — still save the message
  }

  // Notify owner if AI failed to process the message
  if (result.llmFailed && tenant.phone && channel === 'whatsapp') {
    const customerName = customer.displayName ?? customer.phone ?? from;
    const alert = `⚠️ Falla del asistente IA\nCliente: ${customerName}\nMensaje: "${text.slice(0, 100)}"\nEl cliente recibió un mensaje de fallback.`;
    sendMessage(tenantId, 'whatsapp', tenant.phone, { type: 'text', text: alert }).catch(() => undefined);
  }

  const outbound = await saveOutboundMessage(tenantId, conversation.id, customer.id, result.response);

  // Push AI response to inbox SSE
  pushInboxEvent(tenantId, 'message', {
    conversationId: conversation.id,
    message: outbound,
    customer: { id: customer.id, displayName: customer.displayName ?? from, phone: customer.phone },
  });
}
