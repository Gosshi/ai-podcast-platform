import test from "node:test";
import assert from "node:assert/strict";

const loadLegalModule = async (env: Record<string, string | undefined> = {}) => {
  const original = {
    LEGAL_CONTACT_EMAIL: process.env.LEGAL_CONTACT_EMAIL,
    LEGAL_PHONE_DISCLOSURE_MODE: process.env.LEGAL_PHONE_DISCLOSURE_MODE,
    LEGAL_PHONE_NUMBER: process.env.LEGAL_PHONE_NUMBER
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await import(`../src/lib/legal.ts?ts=${Date.now()}`);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("getPublicContactEmailText replaces @ with at for public display", async () => {
  const legal = await loadLegalModule({
    LEGAL_CONTACT_EMAIL: "hello@signal-move.com"
  });

  assert.equal(legal.getPublicContactEmailText(), "hello at signal-move.com");
});

test("getCommercialDisclosurePhoneText uses obfuscated email in request mode", async () => {
  const legal = await loadLegalModule({
    LEGAL_CONTACT_EMAIL: "hello@signal-move.com",
    LEGAL_PHONE_DISCLOSURE_MODE: "request"
  });

  assert.match(legal.getCommercialDisclosurePhoneText(), /hello at signal-move\.com/);
});
