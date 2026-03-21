import test from "node:test";
import assert from "node:assert/strict";

const withEnv = async <T>(
  env: Record<string, string | undefined>,
  run: (module: typeof import("../src/lib/audioStorage.ts")) => Promise<T> | T
) => {
  const previous = {
    AUDIO_STORAGE_BUCKET: process.env.AUDIO_STORAGE_BUCKET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    const module = await import(`../src/lib/audioStorage.ts?ts=${Date.now()}`);
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

test("buildAudioStorageObjectPath namespaces objects by episode and language", async () => {
  await withEnv({}, async (mod) => {
    assert.equal(
      mod.buildAudioStorageObjectPath({
        episodeId: "episode-1",
        lang: "ja",
        audioVersion: "abc123",
        format: "mp3"
      }),
      "episodes/episode-1/ja/abc123.mp3"
    );
  });
});

test("resolveAudioStorageBucket uses env override and defaults to audio", async () => {
  await withEnv({ AUDIO_STORAGE_BUCKET: undefined }, async (mod) => {
    assert.equal(mod.resolveAudioStorageBucket(), "audio");
  });

  await withEnv({ AUDIO_STORAGE_BUCKET: "podcast-audio" }, async (mod) => {
    assert.equal(mod.resolveAudioStorageBucket(), "podcast-audio");
  });
});

test("canUseSupabaseAudioStorage requires service role and supabase url", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: undefined
    },
    async (mod) => {
      assert.equal(mod.canUseSupabaseAudioStorage(), true);
    }
  );

  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: undefined
    },
    async (mod) => {
      assert.equal(mod.canUseSupabaseAudioStorage(), false);
    }
  );
});
