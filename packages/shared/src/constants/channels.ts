export const CHANNEL_TYPES = ['whatsapp', 'instagram', 'facebook', 'tiktok'] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CHANNEL_COLORS: Record<ChannelType, string> = {
  whatsapp: '#25D366',
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#FE2C55',
};
