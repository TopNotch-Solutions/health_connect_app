import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { buildBackendAssetUrl } from "./backend";

const AILMENT_CATEGORIES_CACHE_KEY = "health_connect_ailment_categories_v1";

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

export async function getCachedAilmentCategories(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(AILMENT_CATEGORIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return normalizeAilmentCategories(parsed);
  } catch (error) {
    console.warn("Failed to read cached ailment categories:", error);
    return null;
  }
}

export async function setCachedAilmentCategories(
  categories: any[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      AILMENT_CATEGORIES_CACHE_KEY,
      JSON.stringify(categories),
    );
  } catch (error) {
    console.warn("Failed to cache ailment categories:", error);
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
