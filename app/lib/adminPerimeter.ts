type Ipv4CidrRule = {
  kind: "cidr";
  source: string;
  network: number;
  mask: number;
};

type ExactIpRule = {
  kind: "exact";
  source: string;
  value: string;
};

export type AdminIpRule = Ipv4CidrRule | ExactIpRule;

const normalizeIp = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutPort = trimmed.startsWith("[")
    ? trimmed.replace(/^\[([^\]]+)\](?::\d+)?$/, "$1")
    : trimmed.replace(/:\d+$/, "");

  if (withoutPort.startsWith("::ffff:")) {
    return withoutPort.slice("::ffff:".length);
  }

  return withoutPort;
};

const parseIpv4 = (value: string): number | null => {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const segment = Number(part);
    if (!Number.isInteger(segment) || segment < 0 || segment > 255) {
      return null;
    }
    result = (result << 8) | segment;
  }

  return result >>> 0;
};

const parseIpv4CidrRule = (value: string): Ipv4CidrRule | null => {
  const [base, prefixRaw] = value.split("/");
  if (!base || !prefixRaw || !/^\d+$/.test(prefixRaw)) {
    return null;
  }

  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }

  const baseIp = parseIpv4(base);
  if (baseIp === null) {
    return null;
  }

  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return {
    kind: "cidr",
    source: value,
    network: baseIp & mask,
    mask
  };
};

const parseIpRule = (value: string): AdminIpRule | null => {
  const normalized = normalizeIp(value);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("/")) {
    return parseIpv4CidrRule(normalized);
  }

  return {
    kind: "exact",
    source: normalized,
    value: normalized
  };
};

export const parseAdminIpRules = (raw: string | null | undefined): AdminIpRule[] => {
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => parseIpRule(entry))
    .filter((entry): entry is AdminIpRule => Boolean(entry));
};

export const extractClientIp = (headers: Headers): string | null => {
  const direct =
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("fly-client-ip");

  if (direct?.trim()) {
    return normalizeIp(direct);
  }

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) {
    return null;
  }

  const first = forwarded.split(",")[0]?.trim() ?? null;
  return normalizeIp(first);
};

export const isIpAllowed = (ip: string | null | undefined, rules: AdminIpRule[]): boolean => {
  if (rules.length === 0) {
    return true;
  }

  const normalized = normalizeIp(ip);
  if (!normalized) {
    return false;
  }

  const ipv4 = parseIpv4(normalized);
  return rules.some((rule) => {
    if (rule.kind === "exact") {
      return normalized === rule.value;
    }

    if (ipv4 === null) {
      return false;
    }

    return (ipv4 & rule.mask) === rule.network;
  });
};

export const decodeBasicAuth = (header: string | null | undefined): { username: string; password: string } | null => {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const encoded = header.slice("Basic ".length).trim();
  if (!encoded) {
    return null;
  }

  try {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
};

export const hasValidAdminBasicAuth = (
  header: string | null | undefined,
  username: string | null | undefined,
  password: string | null | undefined
): boolean => {
  const expectedUser = username?.trim();
  const expectedPassword = password?.trim();
  if (!expectedUser || !expectedPassword) {
    return false;
  }

  const decoded = decodeBasicAuth(header);
  if (!decoded) {
    return false;
  }

  return decoded.username === expectedUser && decoded.password === expectedPassword;
};

export const isAdminPerimeterTarget = (pathname: string): boolean => {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
};

export const isAdminPerimeterEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  return Boolean(
    env.ADMIN_IP_ALLOWLIST?.trim() ||
      (env.ADMIN_BASIC_AUTH_USER?.trim() && env.ADMIN_BASIC_AUTH_PASSWORD?.trim())
  );
};
