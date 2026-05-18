import type { IChannelDriver, ChannelType, OutgoingMessage, NormalizedMessage } from './channel-driver.interface.js';
import { db, channelSessions, eq, and } from '@saas/db';

const drivers = new Map<ChannelType, IChannelDriver>();

export function registerDriver(driver: IChannelDriver): void {
  drivers.set(driver.channel, driver);
}

export function getDriver(channel: ChannelType): IChannelDriver | undefined {
  return drivers.get(channel);
}

export function onIncomingMessage(channel: ChannelType, handler: (msg: NormalizedMessage) => Promise<void>): void {
  const driver = drivers.get(channel);
  if (driver) driver.onIncoming(handler);
}

export async function sendMessage(
  tenantId: string,
  channel: ChannelType,
  to: string,
  message: OutgoingMessage,
): Promise<void> {
  const driver = drivers.get(channel);
  if (!driver) throw new Error(`No driver registered for channel: ${channel}`);

  const [session] = await db
    .select({ id: channelSessions.id, externalId: channelSessions.externalId })
    .from(channelSessions)
    .where(and(eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, channel), eq(channelSessions.status, 'connected')));

  if (!session) throw new Error(`No active ${channel} session for tenant ${tenantId}`);

  await driver.sendMessage(session.externalId ?? session.id, to, message);
}
