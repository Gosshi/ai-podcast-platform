import test from "node:test";
import assert from "node:assert/strict";

const loadModule = async () => {
  return import(`../src/lib/affiliateLinks.ts?ts=${Date.now()}`);
};

test("affiliate registry hides placeholder URLs when env is unset", async () => {
  delete process.env.NEXT_PUBLIC_AFFILIATE_URL_UNEXT;
  delete process.env.NEXT_PUBLIC_AFFILIATE_URL_AUDIBLE;
  delete process.env.NEXT_PUBLIC_AFFILIATE_URL_1PASSWORD;
  delete process.env.NEXT_PUBLIC_AFFILIATE_URL_NORDVPN;
  delete process.env.NEXT_PUBLIC_AFFILIATE_URL_GAMEPASS;

  const { AFFILIATE_LINKS } = await loadModule();

  assert.equal(AFFILIATE_LINKS.every((link) => link.active === false), true);
  assert.equal(AFFILIATE_LINKS.every((link) => link.url === ""), true);
});

test("buildAffiliateUrl appends tracking params", async () => {
  const { buildAffiliateUrl } = await loadModule();

  const url = buildAffiliateUrl("https://partner.example.com/product", {
    episodeId: "ep-1",
    cardTopic: "vpn",
    source: "card"
  });

  assert.equal(
    url,
    "https://partner.example.com/product?ref_episode=ep-1&ref_topic=vpn&ref_source=card"
  );
});
