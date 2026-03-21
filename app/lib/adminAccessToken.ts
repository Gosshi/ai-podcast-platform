import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;
export const ADMIN_ACCESS_OTP_TTL_MINUTES = 10;
const DEFAULT_ADMIN_NEXT_PATH = "/admin/trends";

type AdminAccessPayload = {
  userId: string;
  expiresAt: number;
};

const signPayload = (payload: AdminAccessPayload, secret: string): string => {
  const message = `${payload.userId}.${payload.expiresAt}`;
  return createHmac("sha256", secret).update(message).digest("base64url");
};

const parsePayload = (token: string): AdminAccessPayload | null => {
  const [userId, expiresAtRaw, signature] = token.split(".");
  if (!userId || !expiresAtRaw || !signature) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return null;
  }

  return {
    userId,
    expiresAt
  };
};

export const createAdminAccessCookieValue = (
  userId: string,
  secret: string,
  now = Date.now()
): string => {
  const payload: AdminAccessPayload = {
    userId,
    expiresAt: now + ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS * 1000
  };

  return `${payload.userId}.${payload.expiresAt}.${signPayload(payload, secret)}`;
};

export const verifyAdminAccessCookieValue = (
  token: string | null | undefined,
  expectedUserId: string,
  secret: string,
  now = Date.now()
): boolean => {
  if (!token) {
    return false;
  }

  const payload = parsePayload(token);
  if (!payload || payload.userId !== expectedUserId || payload.expiresAt <= now) {
    return false;
  }

  const [, , receivedSignature] = token.split(".");
  const expectedSignature = signPayload(payload, secret);

  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
};

export const generateAdminAccessCode = (): string => {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
};

export const isValidAdminAccessCodeFormat = (input: string): boolean => {
  return /^\d{6}$/.test(input.trim());
};

export const hashAdminAccessCode = (userId: string, code: string, secret: string): string => {
  return createHmac("sha256", secret).update(`${userId}.${code.trim()}`).digest("hex");
};

export const verifyAdminAccessCode = (
  userId: string,
  input: string,
  expectedHash: string,
  secret: string
): boolean => {
  if (!isValidAdminAccessCodeFormat(input)) {
    return false;
  }

  const inputBuffer = Buffer.from(hashAdminAccessCode(userId, input, secret));
  const expectedBuffer = Buffer.from(expectedHash);
  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
};

export const normalizeAdminNextPath = (value: string | null | undefined): string => {
  if (!value) {
    return DEFAULT_ADMIN_NEXT_PATH;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin")) {
    return DEFAULT_ADMIN_NEXT_PATH;
  }

  if (trimmed.startsWith("//")) {
    return DEFAULT_ADMIN_NEXT_PATH;
  }

  return trimmed;
};
