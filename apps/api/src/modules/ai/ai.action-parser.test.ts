import { describe, it, expect } from 'vitest';
import { parseAction, isCapabilityAllowed } from './ai.action-parser.js';

describe('parseAction', () => {
  it('parses a bare JSON action object', () => {
    const text = JSON.stringify({ accion: 'VER_CATALOGO', params: {} });
    const result = parseAction(text);
    expect(result).not.toBeNull();
    expect(result?.accion).toBe('VER_CATALOGO');
  });

  it('parses action inside a markdown code block', () => {
    const text = '```json\n{"accion":"CREAR_CITA","params":{"fecha":"2026-06-01"}}\n```';
    const result = parseAction(text);
    expect(result?.accion).toBe('CREAR_CITA');
    expect(result?.params).toEqual({ fecha: '2026-06-01' });
  });

  it('parses action embedded in prose', () => {
    const text = 'Claro, te ayudo. {"accion":"INFO_NEGOCIO","params":{}} Aquí la info.';
    const result = parseAction(text);
    expect(result?.accion).toBe('INFO_NEGOCIO');
  });

  it('returns null for plain text with no JSON', () => {
    const result = parseAction('Hola, ¿en qué puedo ayudarte?');
    expect(result).toBeNull();
  });

  it('returns null for JSON without accion field', () => {
    const result = parseAction('{"foo":"bar"}');
    expect(result).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    const result = parseAction('{accion: VER_CATALOGO}');
    expect(result).toBeNull();
  });

  it('defaults params to empty object when omitted', () => {
    const result = parseAction('{"accion":"ESCALAMIENTO"}');
    expect(result?.params).toEqual({});
  });
});

describe('isCapabilityAllowed', () => {
  it('allows INFO_NEGOCIO always (no capability required)', () => {
    expect(isCapabilityAllowed('INFO_NEGOCIO', [])).toBe(true);
  });

  it('allows ESCALAMIENTO always', () => {
    expect(isCapabilityAllowed('ESCALAMIENTO', [])).toBe(true);
  });

  it('allows VER_CATALOGO when catalog capability present', () => {
    expect(isCapabilityAllowed('VER_CATALOGO', ['catalog'])).toBe(true);
  });

  it('disallows VER_CATALOGO when catalog capability absent', () => {
    expect(isCapabilityAllowed('VER_CATALOGO', ['appointments'])).toBe(false);
  });

  it('disallows CREAR_CITA without appointments capability', () => {
    expect(isCapabilityAllowed('CREAR_CITA', [])).toBe(false);
  });

  it('allows CREAR_PEDIDO with cart_orders capability', () => {
    expect(isCapabilityAllowed('CREAR_PEDIDO', ['cart_orders'])).toBe(true);
  });

  it('allows ENVIAR_PAGO with payments capability', () => {
    expect(isCapabilityAllowed('ENVIAR_PAGO', ['payments'])).toBe(true);
  });

  it('returns false for unknown actions', () => {
    expect(isCapabilityAllowed('UNKNOWN_ACTION', ['catalog', 'payments'])).toBe(false);
  });
});
