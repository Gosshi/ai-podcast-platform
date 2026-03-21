import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicEpisodePath,
  buildPublicEpisodeUrl
} from "../src/lib/episodeLinks.ts";

test("buildPublicEpisodePath returns public episode permalink", () => {
  assert.equal(buildPublicEpisodePath("episode-123"), "/episodes/episode-123");
});

test("buildPublicEpisodeUrl builds an absolute permalink", () => {
  assert.equal(
    buildPublicEpisodeUrl("episode-123", "https://signal-move.com"),
    "https://signal-move.com/episodes/episode-123"
  );
});
