"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "./locale";

export const useLocale = (initialLocale: Locale = DEFAULT_LOCALE) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const locale = resolveLocale(searchParams.get("lang") ?? initialLocale);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextLocale === DEFAULT_LOCALE) {
        params.delete("lang");
      } else {
        params.set("lang", nextLocale);
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return {
    locale,
    setLocale
  };
};
