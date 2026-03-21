import test from "node:test";
import assert from "node:assert/strict";

const withEnv = async <T>(
  env: Record<string, string | undefined>,
  run: (module: typeof import("../src/lib/social/xPublisher.ts")) => Promise<T> | T
) => {
  const previous = {
    X_AUTO_POST_ENABLED: process.env.X_AUTO_POST_ENABLED,
    TWITTER_API_KEY: process.env.TWITTER_API_KEY,
    TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    const module = await import(`../src/lib/social/xPublisher.ts?ts=${Date.now()}`);
    return await run(module);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("resolveXAutoPostEnabled only enables explicit true", async () => {
  await withEnv({ X_AUTO_POST_ENABLED: "true" }, async (mod) => {
    assert.equal(mod.resolveXAutoPostEnabled(), true);
  });

  await withEnv({ X_AUTO_POST_ENABLED: "false" }, async (mod) => {
    assert.equal(mod.resolveXAutoPostEnabled(), false);
  });
});

test("resolveXCredentials reports missing environment keys", async () => {
  await withEnv(
    {
      TWITTER_API_KEY: "key",
      TWITTER_API_SECRET: undefined,
      TWITTER_ACCESS_TOKEN: "token",
      TWITTER_ACCESS_SECRET: undefined
    },
    async (mod) => {
      const { credentials, missingKeys } = mod.resolveXCredentials();

      assert.equal(credentials, null);
      assert.deepEqual(missingKeys, ["TWITTER_API_SECRET", "TWITTER_ACCESS_SECRET"]);
    }
  );
});

test("resolveXCredentials returns credentials when fully configured", async () => {
  await withEnv(
    {
      TWITTER_API_KEY: "key",
      TWITTER_API_SECRET: "secret",
      TWITTER_ACCESS_TOKEN: "token",
      TWITTER_ACCESS_SECRET: "access-secret"
    },
    async (mod) => {
      const { credentials, missingKeys } = mod.resolveXCredentials();

      assert.deepEqual(missingKeys, []);
      assert.deepEqual(credentials, {
        appKey: "key",
        appSecret: "secret",
        accessToken: "token",
        accessSecret: "access-secret"
      });
    }
  );
});
