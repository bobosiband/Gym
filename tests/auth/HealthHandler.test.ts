import { describe, expect, it } from 'vitest';

import { HealthHandler } from '../../services/auth/src/handlers/HealthHandler.js';

describe('HealthHandler', () => {
  it('returns 200 and an HTML content-type', () => {
    const response = HealthHandler.handle();
    expect(response.statusCode).toBe(200);
    expect(response.headers?.['content-type']).toContain('text/html');
  });

  it('refuses to cache the response', () => {
    const response = HealthHandler.handle();
    expect(response.headers?.['cache-control']).toBe('no-store');
  });

  it('sets x-content-type-options and referrer-policy', () => {
    const response = HealthHandler.handle();
    expect(response.headers?.['x-content-type-options']).toBe('nosniff');
    expect(response.headers?.['referrer-policy']).toBe('no-referrer');
  });

  it('renders an HTML page with the service name and an ISO timestamp', () => {
    const response = HealthHandler.handle();
    const html = String(response.body);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Gym auth: ok</title>');
    expect(html).toContain('Gym auth');
    expect(html).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it('includes the pulsing status pill and animated backdrop keyframes', () => {
    const response = HealthHandler.handle();
    const html = String(response.body);
    expect(html).toContain('@keyframes pulse');
    expect(html).toContain('@keyframes drift');
    expect(html).toContain('@keyframes rise');
  });

  it('respects prefers-reduced-motion', () => {
    const response = HealthHandler.handle();
    const html = String(response.body);
    expect(html).toContain('prefers-reduced-motion');
  });

  it('ships a tiny self-contained clock script, no external resources', () => {
    const response = HealthHandler.handle();
    const html = String(response.body);
    expect(html).toContain('getElementById("local-clock")');
    expect(html).not.toContain('http://');
    expect(html.match(/https:\/\//g)).toBeNull();
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('<link ');
  });

  it('escapes the rendered timestamp so no HTML can leak in', () => {
    const first = String(HealthHandler.handle().body);
    expect(first).not.toContain('<script>alert');
    // The timestamp lives inside a span and never contains angle brackets.
    expect(first).toMatch(/<span class="v" id="server-time">[^<]+<\/span>/);
  });
});
