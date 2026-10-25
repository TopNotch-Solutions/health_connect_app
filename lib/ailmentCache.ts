import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { buildBackendAssetUrl } from "./backend";

const AILMENT_CATEGORIES_CACHE_KEY = "health_connect_ailment_categories_v3";
/** Cache expires after 10 minutes so portal price/title changes cannot linger forever. */
const AILMENT_CACHE_TTL_MS = 10 * 60 * 1000;

type CachedAilmentPayload = {
  cachedAt: number;
  categories: any[];
};

const formatProviderRole = (role: string) =>
  role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

/** Resolve a human-readable provider label for ailment cards (home, See all, etc.). */
export function getAilmentProviderLabel(category: any): string {
  const roles =
    category?.specialization
      ?.map((spec: any) => spec?.role)
      .filter(
        (role: unknown): role is string =>
          typeof role === "string" && role.trim().length > 0,
      ) || [];

  const uniqueRoles = [
    ...new Set(roles.map((role: string) => formatProviderRole(role))),
  ];
  if (uniqueRoles.length > 0) {
    return uniqueRoles.join(", ");
  }

  const providerField = String(
    category?.provider ?? category?.providerType ?? "",
  ).trim();
  if (providerField.length > 0) {
    return providerField
      .split(",")
      .map((part) => formatProviderRole(part.trim()))
      .filter(Boolean)
      .join(", ");
  }

  return "Other";
}

/** Map specialization roles to a display provider label. */
export function normalizeAilmentCategories(categories: any[]): any[] {
  return categories.map((category: any) => ({
    ...category,
    provider: getAilmentProviderLabel(category),
  }));
}

function parseCachedPayload(raw: string): CachedAilmentPayload | null {
  try {
    const parsed = JSON.parse(raw);
    // New shape: { cachedAt, categories }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.categories)
    ) {
      return {
        cachedAt: Number(parsed.cachedAt) || 0,
        categories: parsed.categories,
      };
    }
    // Legacy shape: bare array
    if (Array.isArray(parsed)) {
      return { cachedAt: 0, categories: parsed };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getCachedAilmentCategories(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(AILMENT_CATEGORIES_CACHE_KEY);
    if (!raw) {
      // Migrate: also clear legacy key so stale v2 data is not re-read elsewhere
      await AsyncStorage.removeItem(
        "health_connect_ailment_categories_v2",
      ).catch(() => {});
      return null;
    }
    const payload = parseCachedPayload(raw);
    if (!payload || payload.categories.length === 0) return null;

    const age = Date.now() - payload.cachedAt;
    if (!payload.cachedAt || age > AILMENT_CACHE_TTL_MS) {
      await AsyncStorage.removeItem(AILMENT_CATEGORIES_CACHE_KEY).catch(
        () => {},
      );
      return null;
    }

    return normalizeAilmentCategories(payload.categories);
  } catch (error) {
    console.warn("Failed to read cached ailment categories:", error);
    return null;
  }
}

export async function setCachedAilmentCategories(
  categories: any[],
): Promise<void> {
  try {
    const payload: CachedAilmentPayload = {
      cachedAt: Date.now(),
      categories,
    };
    await AsyncStorage.setItem(
      AILMENT_CATEGORIES_CACHE_KEY,
      JSON.stringify(payload),
    );
  } catch (error) {
    console.warn("Failed to cache ailment categories:", error);
  }
}

/** Drop cached ailments so the next fetch pulls portal-fresh catalog data. */
export async function clearAilmentCategoriesCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      AILMENT_CATEGORIES_CACHE_KEY,
      "health_connect_ailment_categories_v2",
    ]);
  } catch (error) {
    console.warn("Failed to clear ailment categories cache:", error);
  }
}

/** Warm disk/memory cache for ailment thumbnails (expo-image). */
export async function prefetchAilmentCategoryImages(
  categories: any[],
  limit = 6,
): Promise<void> {
  const urls = categories
    .slice(0, limit)
    .map((category) => buildBackendAssetUrl("ailments", category.image))
    .filter((uri): uri is string => Boolean(uri));

  if (urls.length === 0) return;

  await Image.prefetch(urls, { cachePolicy: "memory-disk" }).catch(() => {
    // Prefetch is best-effort; cards still load from network if this fails.
  });
}
