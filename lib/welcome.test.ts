import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sendWelcome, welcomeEmail, type Welcome } from "./welcome";

const jane: Welcome = {
  to: "jane@frostbuddy.com",
  brand: "Frost Buddy",
  invitedBy: "op@walkoff.io",
  uploadUrl: "https://www.walkoff.io/upload/AbCdEfGhIjKlMnOpQrStUvWx",
  connectorUrl: "https://www.walkoff.io/mcp",
  guideUrl: "https://www.walkoff.io/onboarding",
};

const env = process.env as Record<string, string | undefined>;

async function withEnv(values: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, env[k]]));
  const set = (vs: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vs)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  };
  set(values);
  try {
    await fn();
  } finally {
    set(saved);
  }
}

describe("welcomeEmail", () => {
  it("says who invited them and to which brand", () => {
    const { subject, text } = welcomeEmail(jane);
    assert.equal(subject, "You're invited to Walkoff for Frost Buddy");
    assert.match(text, /^op@walkoff\.io invited you to use Walkoff for Frost Buddy\.\n/);
    assert.match(text, /Questions\? Reply to this email\./);
  });

  it("links their upload page and says what to upload", () => {
    const { text } = welcomeEmail(jane);
    assert.ok(text.includes(`\n${jane.uploadUrl}\n`), "the link sits on its own line so mail apps link all of it");
    assert.match(text, /Shopify orders export \(best\) or a customers export/);
    assert.match(text, /In step 2, add your products export\. The page shows how to export each one\./);
    assert.match(text, /This link is private to Frost Buddy/);
  });

  it("gives the connector steps, for Team and Enterprise plans too, and a first question", () => {
    const { text } = welcomeEmail(jane);
    assert.match(text, /Customize → Connectors → Add custom connector/);
    assert.ok(text.includes(`\n${jane.connectorUrl}\n`));
    assert.match(text, /sign in with this email address \(jane@frostbuddy\.com\)/);
    assert.match(text, /On a Team or Enterprise plan, an owner adds the connector first, under Organization settings → Connectors\./);
    assert.match(text, /"What should we send this week\?"/);
  });

  it("links the setup guide, on its own line", () => {
    const { text } = welcomeEmail(jane);
    assert.ok(text.includes(`The setup guide walks through each step:\n${jane.guideUrl}\n`));
  });

  it("tells someone signed in for another brand to connect again, and still gives every step", () => {
    const { text } = welcomeEmail({ ...jane, reconnect: true });
    assert.match(text, /Already connected Walkoff for another brand\? Disconnect it in Claude's connector settings and connect again, so you can pick Frost Buddy too\./);
    assert.ok(text.includes(`\n${jane.connectorUrl}\n`), "they may be connecting from a different app");
    assert.match(text, /Customize → Connectors → Add custom connector/);
    assert.ok(text.includes(jane.uploadUrl));
    assert.ok(!welcomeEmail(jane).text.includes("Already connected"));
  });

  it("without an inviter, sends questions to hello@walkoff.io", () => {
    const { text } = welcomeEmail({ ...jane, invitedBy: null });
    assert.match(text, /^You're invited to use Walkoff for Frost Buddy\./);
    assert.match(text, /Questions\? Email hello@walkoff\.io\./);
  });

  it("writes plain sentences without em dashes", () => {
    for (const w of [jane, { ...jane, reconnect: true }, { ...jane, invitedBy: null }]) {
      const { subject, text } = welcomeEmail(w);
      assert.ok(!/[—–]/.test(subject + text));
    }
  });
});

describe("sendWelcome", () => {
  it("prints the email to the server log when Resend isn't set up outside production", async (t) => {
    const log = t.mock.method(console, "log", () => {});
    await withEnv({ RESEND_API_KEY: undefined, NODE_ENV: "development" }, async () => {
      assert.equal(await sendWelcome(jane), "dev");
    });
    const printed = log.mock.calls.map((c) => String(c.arguments[0])).join("\n");
    assert.match(printed, /welcome email for jane@frostbuddy\.com/);
    assert.ok(printed.includes(jane.uploadUrl));
  });

  it("fails loudly in production without Resend, rather than skip the email", async () => {
    await withEnv({ RESEND_API_KEY: undefined, NODE_ENV: "production" }, async () => {
      await assert.rejects(sendWelcome(jane), /RESEND_API_KEY is not set/);
    });
  });
});
