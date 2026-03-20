import { cookies } from "next/headers";
import {
  ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS,
  createAdminAccessCookieValue as createCookieValue,
  isValidAdminPasscode as isValidPasscode,
  normalizeAdminNextPath,
  verifyAdminAccessCookieValue as verifyCookieValue
} from "./adminAccessToken";

export const ADMIN_ACCESS_COOKIE = "app_admin_access";

const getAdminAccessSecret = (): string | null => {
  const value = process.env.ADMIN_ACCESS_SECRET?.trim();
  return value ? value : null;
};

const getAdminAccessPasscode = (): string | null => {
  const value = process.env.ADMIN_ACCESS_PASSCODE?.trim();
  return value ? value : null;
};

export const isAdminAccessGateEnabled = (): boolean => {
  return Boolean(getAdminAccessSecret() && getAdminAccessPasscode());
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

export const isValidAdminPasscode = (input: string): boolean => {
  const expected = getAdminAccessPasscode();
  if (!expected) {
    return false;
  }

  return isValidPasscode(input, expected);
};
