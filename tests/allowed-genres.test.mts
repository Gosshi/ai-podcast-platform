import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ALLOWED_GENRES,
  isGenreAllowed,
  resolveAllowedGenres
} from "../src/lib/genre/allowedGenres.ts";

test("resolveAllowedGenres falls back to default set", () => {
  const resolved = resolveAllowedGenres(undefined);
  assert.deepEqual(resolved, [...DEFAULT_ALLOWED_GENRES]);
});

test("resolveAllowedGenres parses and normalizes env list", () => {
  const resolved = resolveAllowedGenres("general, Entertainment,tech, tech ");
  assert.deepEqual(resolved, ["general", "entertainment", "tech"]);
});

test("isGenreAllowed validates normalized genre names", () => {
  const allowedGenres = resolveAllowedGenres("general,entertainment");
  assert.equal(isGenreAllowed("ENTERTAINMENT", allowedGenres), true);
  assert.equal(isGenreAllowed("business", allowedGenres), false);
});

