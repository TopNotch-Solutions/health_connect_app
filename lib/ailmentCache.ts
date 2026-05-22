import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { buildBackendAssetUrl } from "./backend";

const AILMENT_CATEGORIES_CACHE_KEY = "health_connect_ailment_categories_v1";

/** Map specialization roles to a display provider label (matches all_ailments). */
export function normalizeAilmentCategories(categories: any[]): any[] {
  return categories.map((category: any) => {
    const roles =
      category.specialization?.map((spec: any) => spec.role) || [];
    const uniqueRoles = [...new Set(roles)];
    const provider =
      uniqueRoles.length > 0
        ? uniqueRoles.join(", ")
        : (category.provider ?? "Other");
    return { ...category, provider };
  });
}

export async function getCachedAilmentCategories(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(AILMENT_CATEGORIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
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
