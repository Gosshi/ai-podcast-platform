import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPodcastFeedXml,
  formatDuration,
  isPodcastCompatibleAudioUrl,
  resolveAudioExtension,
  resolveAudioContentType
} from "../src/lib/podcastFeed.ts";

test("resolveAudioContentType follows file extension", () => {
  assert.equal(resolveAudioContentType("https://example.com/audio.mp3"), "audio/mpeg");
  assert.equal(resolveAudioContentType("https://example.com/audio.m4a"), "audio/aac");
  assert.equal(resolveAudioContentType("https://example.com/audio.wav"), "audio/wav");
});

test("podcast compatibility only allows mp3 and aac family URLs", () => {
  assert.equal(resolveAudioExtension("/audio/episode.ja.feed.mp3"), "mp3");
  assert.equal(resolveAudioExtension("https://example.com/audio/episode.m4a?token=123"), "m4a");
  assert.equal(isPodcastCompatibleAudioUrl("/audio/episode.ja.feed.mp3"), true);
  assert.equal(isPodcastCompatibleAudioUrl("/audio/episode.ja.feed.aac"), true);
  assert.equal(isPodcastCompatibleAudioUrl("/audio/episode.ja.feed.m4a"), true);
  assert.equal(isPodcastCompatibleAudioUrl("/audio/episode.ja.feed.wav"), false);
  assert.equal(isPodcastCompatibleAudioUrl(null), false);
});

test("formatDuration formats minute and hour durations", () => {
  assert.equal(formatDuration(65), "01:05");
  assert.equal(formatDuration(3723), "1:02:03");
});

test("buildPodcastFeedXml includes channel metadata and enclosure type", () => {
  const xml = buildPodcastFeedXml([
    {
      id: "episode-1",
      title: "最新AIツールまとめ",
      description: "通勤中にチェックしたい要点を整理します。",
      audioUrl: "/audio/episode-1.ja.feed.mp3",
      durationSec: 540,
      publishedAt: "2026-03-21T00:00:00.000Z",
      genre: "tech"
    }
  ]);

  assert.match(xml, /<itunes:type>episodic<\/itunes:type>/);
  assert.match(xml, /<itunes:subtitle>.*<\/itunes:subtitle>/);
  assert.match(xml, /type="audio\/mpeg"/);
  assert.match(xml, /<itunes:episodeType>full<\/itunes:episodeType>/);
  assert.match(xml, /<link>https:\/\/signal-move\.com\/episodes\/episode-1<\/link>/);
});
