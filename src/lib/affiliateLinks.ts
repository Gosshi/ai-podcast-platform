/**
 * Affiliate link registry for services mentioned in episodes.
 *
 * When a topic card recommends adopting, watching, or skipping a service,
 * we can show relevant affiliate links as alternatives or recommendations.
 */

export type AffiliateLink = {
  /** Service name displayed to users */
  name: string;
  /** Short description of why this link is relevant */
  description: string;
  /** The affiliate URL */
  url: string;
  /** Category for matching with episode genres */
  category: "streaming" | "saas" | "gaming" | "shopping" | "finance" | "other";
  /** Keywords for matching with episode/card content */
  keywords: string[];
  /** Whether this link is currently active */
  active: boolean;
};

/**
 * Registry of affiliate links.
 * In production, this could be loaded from a database or CMS.
 * For now, we use a static registry that can be easily extended.
 */
export const AFFILIATE_LINKS: AffiliateLink[] = [
  {
    name: "U-NEXT",
    description: "31日間無料トライアル。映画・アニメ・ドラマが見放題",
    url: "https://example.com/affiliate/unext", // Replace with actual affiliate URL
    category: "streaming",
    keywords: ["netflix", "動画", "映画", "アニメ", "ドラマ", "配信", "VOD", "サブスク"],
    active: true,
  },
  {
    name: "Amazon Audible",
    description: "30日間無料体験。ビジネス書・小説をながら聴き",
    url: "https://example.com/affiliate/audible",
    category: "saas",
    keywords: ["読書", "オーディオブック", "ながら聴き", "本", "ビジネス書"],
    active: true,
  },
  {
    name: "1Password",
    description: "パスワード管理の定番。14日間無料",
    url: "https://example.com/affiliate/1password",
    category: "saas",
    keywords: ["パスワード", "セキュリティ", "管理ツール", "SaaS"],
    active: true,
  },
  {
    name: "NordVPN",
    description: "オンラインプライバシーを守る。30日間返金保証",
    url: "https://example.com/affiliate/nordvpn",
    category: "saas",
    keywords: ["VPN", "セキュリティ", "プライバシー", "ネット"],
    active: true,
  },
  {
    name: "Xbox Game Pass",
    description: "数百タイトルが定額で遊べる。初月100円",
    url: "https://example.com/affiliate/gamepass",
    category: "gaming",
    keywords: ["ゲーム", "Game Pass", "Xbox", "サブスク", "積みゲー"],
    active: true,
  },
];

/**
 * Find relevant affiliate links for a given text context (e.g., topic card content).
 * Returns links sorted by relevance (keyword match count).
 */
export const findRelevantAffiliateLinks = (
  text: string,
  category?: AffiliateLink["category"],
  maxResults = 2,
): AffiliateLink[] => {
  const lowerText = text.toLowerCase();

  const scored = AFFILIATE_LINKS
    .filter((link) => link.active)
    .filter((link) => !category || link.category === category)
    .map((link) => {
      const matchCount = link.keywords.filter((keyword) =>
        lowerText.includes(keyword.toLowerCase())
      ).length;
      return { link, matchCount };
    })
    .filter(({ matchCount }) => matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);

  return scored.slice(0, maxResults).map(({ link }) => link);
};

/**
 * Build an affiliate URL with tracking parameters.
 */
export const buildAffiliateUrl = (
  baseUrl: string,
  params: {
    episodeId?: string;
    cardTopic?: string;
    source?: string;
  },
): string => {
  const url = new URL(baseUrl);
  if (params.episodeId) url.searchParams.set("ref_episode", params.episodeId);
  if (params.cardTopic) url.searchParams.set("ref_topic", params.cardTopic);
  url.searchParams.set("ref_source", params.source ?? "handan");
  return url.toString();
};
