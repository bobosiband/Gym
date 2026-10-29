import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * Health probe for `GET /health`.
 *
 * Returns a self-contained HTML page: no external CSS, no external
 * scripts, no CDN fonts, no tracking. The page shows the server's
 * current UTC timestamp (rendered at request time) and a live local
 * clock in the browser, with a pulsing status pill and an animated
 * gradient backdrop so an operator can see at a glance that the API
 * is up.
 *
 * The handler reads nothing: no DynamoDB, no SSM, no SMTP, no key
 * import. That is the point of a health probe. The HTML is built
 * from a module-level template so even the HTML string is static
 * except for the one timestamp substitution.
 *
 * Stateless; use via the static `handle` method. The private
 * constructor prevents accidental instantiation.
 */
export class HealthHandler {
  private constructor() {
    // utility class; never instantiated
  }

  public static handle(): APIGatewayProxyStructuredResultV2 {
    const nowIso = new Date().toISOString();
    const body = HealthHandler.renderHtml(nowIso);
    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
      body,
    };
  }

  private static renderHtml(nowIso: string): string {
    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Gym auth: ok</title>',
      '<style>',
      ':root { color-scheme: dark; }',
      '* { box-sizing: border-box; }',
      'html, body { margin: 0; padding: 0; height: 100%; }',
      'body {',
      '  min-height: 100%;',
      '  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;',
      '  color: #e8f1ff;',
      '  background:',
      '    radial-gradient(1200px 800px at 20% 10%, rgba(60,120,255,0.35), transparent 60%),',
      '    radial-gradient(900px 700px at 90% 90%, rgba(140,70,255,0.35), transparent 60%),',
      '    linear-gradient(120deg, #0b1020, #10163a, #0b1020);',
      '  background-size: 100% 100%, 100% 100%, 400% 400%;',
      '  animation: drift 24s ease-in-out infinite;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  overflow: hidden;',
      '}',
      '@keyframes drift {',
      '  0%, 100% { background-position: 0% 0%, 100% 100%, 0% 50%; }',
      '  50% { background-position: 20% 30%, 80% 70%, 100% 50%; }',
      '}',
      '.card {',
      '  position: relative;',
      '  padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1.75rem, 5vw, 3rem);',
      '  border-radius: 20px;',
      '  background: rgba(10, 16, 36, 0.55);',
      '  border: 1px solid rgba(255, 255, 255, 0.08);',
      '  backdrop-filter: blur(12px);',
      '  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);',
      '  animation: rise 0.9s cubic-bezier(.2,.9,.3,1) both;',
      '  max-width: min(560px, 92vw);',
      '  text-align: center;',
      '}',
      '@keyframes rise {',
      '  from { opacity: 0; transform: translateY(14px) scale(0.98); }',
      '  to { opacity: 1; transform: translateY(0) scale(1); }',
      '}',
      '.pill {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 0.55rem;',
      '  padding: 0.4rem 0.9rem;',
      '  border-radius: 999px;',
      '  background: rgba(40, 220, 120, 0.14);',
      '  color: #7fffb0;',
      '  font-size: 0.85rem;',
      '  font-weight: 600;',
      '  letter-spacing: 0.04em;',
      '  text-transform: uppercase;',
      '}',
      '.dot {',
      '  width: 0.65rem;',
      '  height: 0.65rem;',
      '  border-radius: 50%;',
      '  background: #35e37f;',
      '  box-shadow: 0 0 0 0 rgba(53, 227, 127, 0.55);',
      '  animation: pulse 1.6s ease-out infinite;',
      '}',
      '@keyframes pulse {',
      '  0% { box-shadow: 0 0 0 0 rgba(53, 227, 127, 0.55); }',
      '  70% { box-shadow: 0 0 0 14px rgba(53, 227, 127, 0); }',
      '  100% { box-shadow: 0 0 0 0 rgba(53, 227, 127, 0); }',
      '}',
      'h1 {',
      '  margin: 1.1rem 0 0.4rem;',
      '  font-size: clamp(1.5rem, 3.8vw, 2.2rem);',
      '  font-weight: 700;',
      '  letter-spacing: -0.01em;',
      '}',
      '.sub {',
      '  margin: 0 0 1.6rem;',
      '  color: #a9b5d1;',
      '  font-size: 0.95rem;',
      '}',
      '.rows {',
      '  display: grid;',
      '  gap: 0.6rem;',
      '  text-align: left;',
      '  font-size: 0.95rem;',
      '}',
      '.row {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  gap: 1rem;',
      '  padding: 0.6rem 0.9rem;',
      '  border-radius: 12px;',
      '  background: rgba(255, 255, 255, 0.04);',
      '  border: 1px solid rgba(255, 255, 255, 0.06);',
      '}',
      '.k { color: #8aa0c8; }',
      '.v { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }',
      '.cursor {',
      '  display: inline-block;',
      '  width: 0.6ch;',
      '  margin-left: 0.1ch;',
      '  background: currentColor;',
      '  animation: blink 1s steps(1) infinite;',
      '  color: #7fffb0;',
      '}',
      '@keyframes blink { 50% { opacity: 0; } }',
      '@media (prefers-reduced-motion: reduce) {',
      '  body { animation: none; }',
      '  .card { animation: none; }',
      '  .dot { animation: none; box-shadow: none; }',
      '  .cursor { animation: none; }',
      '}',
      '</style>',
      '</head>',
      '<body>',
      '<main class="card" role="status" aria-live="polite">',
      '<span class="pill"><span class="dot" aria-hidden="true"></span>operational</span>',
      '<h1>Gym auth<span class="cursor" aria-hidden="true">&nbsp;</span></h1>',
      '<p class="sub">The sign-in service is up and serving requests.</p>',
      '<div class="rows">',
      '<div class="row"><span class="k">Service</span><span class="v">gym-auth</span></div>',
      `<div class="row"><span class="k">Server time (UTC)</span><span class="v" id="server-time">${HealthHandler.escape(nowIso)}</span></div>`,
      '<div class="row"><span class="k">Your clock</span><span class="v" id="local-clock">loading</span></div>',
      '</div>',
      '</main>',
      '<script>',
      '(function () {',
      '  var el = document.getElementById("local-clock");',
      '  if (!el) return;',
      '  function pad(n) { return n < 10 ? "0" + n : String(n); }',
      '  function tick() {',
      '    var d = new Date();',
      '    el.textContent = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())',
      '      + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());',
      '  }',
      '  tick();',
      '  setInterval(tick, 1000);',
      '})();',
      '</script>',
      '</body>',
      '</html>',
    ].join('\n');
  }

  private static escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
