'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Integration } from '@/lib/api';
import { toast } from '@/hooks/useToast';

const CATEGORIES = ['llm', 'payment', 'shipping', 'crm', 'erp', 'analytics', 'other'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  llm: 'IA / LLM', payment: 'Pagos', shipping: 'Envíos',
  crm: 'CRM', erp: 'ERP', analytics: 'Analítica', other: 'Otro',
};

const PROVIDER_PRESETS: Record<string, { category: string; fields: { key: string; label: string; sensitive: boolean }[] }> = {
  openai:  { category: 'llm',     fields: [{ key: 'apiKey', label: 'API Key', sensitive: true }, { key: 'model', label: 'Modelo (ej. gpt-4o)', sensitive: false }] },
  groq:    { category: 'llm',     fields: [{ key: 'apiKey', label: 'API Key', sensitive: true }, { key: 'model', label: 'Modelo (ej. llama3-70b-8192)', sensitive: false }] },
  wompi:   { category: 'payment', fields: [{ key: 'publicKey', label: 'Public Key', sensitive: false }, { key: 'privateKey', label: 'Private Key', sensitive: true }] },
  stripe:  { category: 'payment', fields: [{ key: 'apiKey', label: 'Secret Key', sensitive: true }, { key: 'webhookSecret', label: 'Webhook Secret', sensitive: true }] },
  custom:  { category: 'other',   fields: [] },
};

export default function IntegrationsPage() {
  const { accessToken } = useAuthStore();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [customProvider, setCustomProvider] = useState('');
  const [category, setCategory] = useState<string>('llm');
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(true);
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decryptedId, setDecryptedId] = useState<string | null>(null);
  const [decryptedConfig, setDecryptedConfig] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const data = await api.integrations.list(accessToken);
    setIntegrations(data);
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const preset = PROVIDER_PRESETS[provider] ?? PROVIDER_PRESETS['custom']!;

  const handleProviderChange = (p: string) => {
    setProvider(p);
    const pre = PROVIDER_PRESETS[p];
    if (pre) { setCategory(pre.category); setConfigFields({}); }
  };

  const saveIntegration = async () => {
    if (!accessToken) return;
    const providerName = provider === 'custom' ? customProvider.trim() : provider;
    if (!providerName) return;
    setSaving(true);
    const config: Record<string, unknown> = {};
    if (provider === 'custom' && configFields['__raw']?.trim()) {
      try {
        const parsed = JSON.parse(configFields['__raw']);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          Object.assign(config, parsed);
        }
      } catch {
        toast.error('JSON de configuración inválido');
      }
    } else {
      for (const [k, v] of Object.entries(configFields)) { if (k !== '__raw' && v.trim()) config[k] = v.trim(); }
    }
    try {
      await api.integrations.create(accessToken, { provider: providerName, category, config, isActive, isPrimary });
      setShowCreate(false);
      setConfigFields({});
      setCustomProvider('');
      setProvider('openai');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando integración');
    } finally { setSaving(false); }
  };

  const deleteIntegration = async (id: string) => {
    if (!accessToken) return;
    await api.integrations.delete(accessToken, id);
    void load();
  };

  const toggleActive = async (integration: Integration) => {
    if (!accessToken) return;
    await api.integrations.patch(accessToken, integration.id, { isActive: !integration.isActive });
    void load();
  };

  const viewConfig = async (id: string) => {
    if (!accessToken) return;
    if (decryptedId === id) { setDecryptedId(null); setDecryptedConfig(null); return; }
    const data = await api.integrations.getConfig(accessToken, id);
    setDecryptedId(id);
    setDecryptedConfig(data.config);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Integraciones</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>Conecta proveedores de IA, pagos, envíos y más.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Nueva integración
        </button>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Nueva integración</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>PROVEEDOR</div>
              <select value={provider} onChange={(e) => handleProviderChange(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }}>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
                <option value="wompi">Wompi</option>
                <option value="stripe">Stripe</option>
                <option value="custom">Otro (personalizado)</option>
              </select>
              {provider === 'custom' && (
                <input value={customProvider} onChange={(e) => setCustomProvider(e.target.value)} placeholder="Nombre del proveedor"
                  style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>CATEGORÍA</div>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          {preset.fields.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {preset.fields.map((f) => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>{f.label.toUpperCase()}</div>
                  <input
                    type={f.sensitive ? 'password' : 'text'}
                    value={configFields[f.key] ?? ''}
                    onChange={(e) => setConfigFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.label}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
          )}

          {provider === 'custom' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>CONFIG (JSON)</div>
              <textarea
                rows={4}
                value={configFields['__raw'] ?? ''}
                onChange={(e) => setConfigFields({ __raw: e.target.value })}
                placeholder='{"apiKey": "...", "endpoint": "..."}'
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 13, resize: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Activa
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
              Principal
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => void saveIntegration()} disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando integraciones...</p>}
      {!loading && integrations.length === 0 && (
        <p style={{ color: 'var(--muted-foreground)' }}>No hay integraciones configuradas. Agrega tu primer proveedor de IA o pagos.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {integrations.map((intg) => (
          <div key={intg.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{intg.provider}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'var(--accent)', color: 'var(--muted-foreground)' }}>
                    {CATEGORY_LABELS[intg.category] ?? intg.category}
                  </span>
                  {intg.isPrimary && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8' }}>Principal</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
                  Configuración oculta por seguridad
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: intg.isActive ? '#22c55e' : '#9ca3af',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{intg.isActive ? 'Activa' : 'Inactiva'}</span>
                <button onClick={() => void viewConfig(intg.id)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 11 }}>
                  {decryptedId === intg.id ? 'Ocultar' : 'Ver config'}
                </button>
                <button onClick={() => void toggleActive(intg)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 11 }}>
                  {intg.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => void deleteIntegration(intg.id)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>
                  Eliminar
                </button>
              </div>
            </div>
            {decryptedId === intg.id && decryptedConfig && (
              <pre style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace', overflow: 'auto' }}>
                {JSON.stringify(decryptedConfig, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
