import { cookies } from "next/headers";
import {
  ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS,
  ADMIN_ACCESS_OTP_TTL_MINUTES,
  createAdminAccessCookieValue as createCookieValue,
  generateAdminAccessCode as generateCode,
  hashAdminAccessCode as hashCode,
  normalizeAdminNextPath,
  verifyAdminAccessCode as verifyCode,
  verifyAdminAccessCookieValue as verifyCookieValue
} from "./adminAccessToken";

export const ADMIN_ACCESS_COOKIE = "app_admin_access";
export { ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS, ADMIN_ACCESS_OTP_TTL_MINUTES, normalizeAdminNextPath };

const getAdminAccessSecret = (): string | null => {
  const value = process.env.ADMIN_ACCESS_SECRET?.trim();
  return value ? value : null;
};

export const isAdminAccessGateEnabled = (): boolean => {
  return Boolean(getAdminAccessSecret());
};

export const createAdminAccessCookieValue = (userId: string, now = Date.now()): string => {
  const secret = getAdminAccessSecret();
  if (!secret) {
    throw new Error("ADMIN_ACCESS_SECRET is required");
  }

  return createCookieValue(userId, secret, now);
};

export const verifyAdminAccessCookieValue = (
  token: string | null | undefined,
  expectedUserId: string,
  now = Date.now()
): boolean => {
  if (!token) {
    return false;
  }

  const secret = getAdminAccessSecret();
  if (!secret) {
    return false;
  }

  return verifyCookieValue(token, expectedUserId, secret, now);
};

export const hasValidAdminAccessCookie = async (expectedUserId: string): Promise<boolean> => {
  if (!isAdminAccessGateEnabled()) {
    return true;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value ?? null;
  return verifyAdminAccessCookieValue(value, expectedUserId);
};

export const generateAdminAccessCode = (): string => {
  return generateCode();
};

export const hashAdminAccessCode = (userId: string, code: string): string => {
  const secret = getAdminAccessSecret();
  if (!secret) {
    throw new Error("ADMIN_ACCESS_SECRET is required");
  }

  return hashCode(userId, code, secret);
};

export const verifyAdminAccessCode = (userId: string, input: string, expectedHash: string): boolean => {
  const secret = getAdminAccessSecret();
  if (!secret) {
    return false;
  }

  return verifyCode(userId, input, expectedHash, secret);
};
