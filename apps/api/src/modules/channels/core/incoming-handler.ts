import type { NormalizedMessage } from './channel-driver.interface.js';
import { db, tenants, channelSessions, conversationState, eq, and } from '@saas/db';
import { findOrCreateCustomer, findOrCreateConversation, saveInboundMessage, saveOutboundMessage } from '../../conversations/conversations.messaging.js';
import { runAIEngine } from '../../ai/ai.engine.js';
import { sendMessage } from './channel-manager.js';
import { pushInboxEvent } from '../../conversations/inbox.sse.js';

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

  const outbound = await saveOutboundMessage(tenantId, conversation.id, customer.id, result.response);

  // Push AI response to inbox SSE
  pushInboxEvent(tenantId, 'message', {
    conversationId: conversation.id,
    message: outbound,
    customer: { id: customer.id, displayName: customer.displayName ?? from, phone: customer.phone },
  });
}
