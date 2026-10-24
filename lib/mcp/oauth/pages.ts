// The sign-in pages Claude opens when someone connects Walkoff: email,
// emailed code, then consent. Plain HTML served by the authorize route.
import { helpPath } from "../../help/pages";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const STYLE = `
@font-face { font-family: Arbeit; src: url("/fonts/arbeit-regular.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: Arbeit; src: url("/fonts/arbeit-bold.woff2") format("woff2"); font-weight: 700; }
@font-face { font-family: "JetBrains Mono"; src: url("/fonts/jetbrains-mono-500.woff2") format("woff2"); font-weight: 500; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;
  background: rgb(244 239 228); color: rgb(26 20 16); font-family: Arbeit, system-ui, sans-serif; }
main { width: 100%; max-width: 440px; background: rgb(251 248 241); border: 1px solid rgb(225 217 199); padding: 32px 28px; }
.mark { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgb(200 68 42); margin: 0 0 18px; }
h1 { font-size: 26px; line-height: 1.15; margin: 0 0 12px; }
p { font-size: 15px; line-height: 1.5; margin: 0 0 16px; color: rgb(60 52 45); }
label { display: block; font-size: 13px; font-weight: 700; margin: 0 0 6px; }
input[type=email], input[type=text] { width: 100%; font: inherit; font-size: 16px; padding: 12px 14px; border: 1px solid rgb(200 190 168); background: #fff; color: inherit; }
input.code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 22px; letter-spacing: 0.3em; }
button { font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; padding: 12px 20px; border: 2px solid rgb(26 20 16); }
.primary { background: rgb(26 20 16); color: rgb(244 239 228); }
.secondary { background: transparent; color: rgb(26 20 16); }
.link { border: 0; padding: 0; background: none; font-weight: 400; font-size: 14px; text-decoration: underline; color: rgb(107 98 88); }
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
.error { background: rgb(200 68 42 / 0.1); border-left: 3px solid rgb(200 68 42); padding: 10px 12px; font-size: 14px; color: rgb(154 51 31); }
.note { font-size: 13px; color: rgb(107 98 88); margin: 18px 0 0; }
.dev { font-size: 13px; color: rgb(107 98 88); }
a { color: rgb(200 68 42); }
input[type=checkbox] { accent-color: rgb(26 20 16); width: 16px; height: 16px; }
.brands { margin: 0 0 8px; padding: 0; list-style: none; }
.brands li { padding: 8px 0; border-top: 1px solid rgb(225 217 199); font-size: 15px; }
.brands label { display: flex; gap: 10px; align-items: center; font-weight: 400; font-size: 15px; margin: 0; }
code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; }
`;

export const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'",
} as const;

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Walkoff</title>
<style>${STYLE}</style>
</head>
<body><main><p class="mark">Walkoff</p>${body}</main></body>
</html>`;
}

const hidden = (name: string, value: string) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
const errorBox = (error?: string) => (error ? `<p class="error" role="alert">${esc(error)}</p>` : "");
/** Help opens in a new tab, so the sign-in stays where it is. */
const helpLink = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export interface FlowView {
  requestId: string;
  /** "Claude" */
  app: string;
  /** "claude.ai", where the person goes back to. */
  returnTo: string;
}

export function emailPage(v: FlowView, opts: { error?: string; email?: string } = {}): string {
  return page(
    "Sign in",
    `<h1>Connect Walkoff to ${esc(v.app)}</h1>
<p>Sign in with the email your Walkoff contact invited. We'll email you a 6-digit code.</p>
${errorBox(opts.error)}
<form method="post">
${hidden("request", v.requestId)}${hidden("step", "email")}
<label for="email">Work email</label>
<input id="email" name="email" type="email" autocomplete="email" required autofocus value="${esc(opts.email ?? "")}">
<div class="actions"><button class="primary" type="submit">Email me a code</button></div>
</form>
<p class="note">After you approve, you'll go back to <strong>${esc(v.returnTo)}</strong>. ${helpLink(helpPath("connect", "sign-in"), "How signing in works")}</p>`,
  );
}

export function codePage(v: FlowView, email: string, opts: { error?: string; devNote?: boolean } = {}): string {
  return page(
    "Check your email",
    `<h1>Check your email</h1>
<p>If <strong>${esc(email)}</strong> has Walkoff access, we've sent it a 6-digit code. It works for 15 minutes.</p>
${opts.devNote ? `<p class="dev">Development: email isn't set up, so the code is in the server log.</p>` : ""}
${errorBox(opts.error)}
<form method="post">
${hidden("request", v.requestId)}${hidden("step", "code")}
<label for="code">Code</label>
<input id="code" class="code" name="code" type="text" inputmode="numeric" pattern="[0-9 ]{6,7}" maxlength="7" autocomplete="one-time-code" required autofocus>
<div class="actions"><button class="primary" type="submit">Continue</button></div>
</form>
<form method="post">${hidden("request", v.requestId)}${hidden("step", "restart")}
<p class="note">No code? Check the address, or ask your Walkoff contact for an invite. ${helpLink(helpPath("troubleshooting", "sign-in"), "Troubleshooting")} <button class="link" type="submit">Use a different email</button></p></form>`,
  );
}

export function consentPage(
  v: FlowView,
  email: string,
  brands: { id: string; name: string }[],
  opts: { operator?: boolean; error?: string } = {},
): string {
  const list = opts.operator
    ? `<ul class="brands"><li><label><input type="checkbox" name="brand" value="all" checked> Every brand (you're a Walkoff operator)</label></li></ul>`
    : brands.length === 1
      ? `<ul class="brands"><li>${esc(brands[0].name)}${hidden("brand", brands[0].id)}</li></ul>`
      : `<ul class="brands">${brands
          .map((b) => `<li><label><input type="checkbox" name="brand" value="${esc(b.id)}" checked> ${esc(b.name)}</label></li>`)
          .join("")}</ul>`;
  return page(
    "Allow access",
    `<h1>Allow ${esc(v.app)} to use Walkoff?</h1>
<p>${esc(v.app)} will see moments, fan territories and product picks, build campaigns, import your catalog and customer counts, and manage triggers and the send log for:</p>
${errorBox(opts.error)}
<form method="post">
${hidden("request", v.requestId)}${hidden("step", "consent")}
${list}
${opts.operator ? `<p>As an operator, ${esc(v.app)} can also create brands, change their settings, and invite or remove people.</p>` : ""}
<div class="actions">
<button class="primary" type="submit" name="decision" value="allow">Allow</button>
<button class="secondary" type="submit" name="decision" value="deny">Cancel</button>
</div>
</form>
<p class="note">Signed in as ${esc(email)}. Approving sends you back to <strong>${esc(v.returnTo)}</strong>.</p>`,
  );
}

export function errorPage(message: string): string {
  return page(
    "Couldn't connect",
    `<h1>Couldn't connect</h1>
<p>${esc(message)}</p>
<p class="note">Close this window and try connecting again from Claude. ${helpLink(helpPath("troubleshooting", "sign-in"), "Troubleshooting")} has the fix for each message. If it keeps happening, email <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>.</p>`,
  );
}
