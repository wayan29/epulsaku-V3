// src/lib/client-price-settings-utils.ts
"use client";

export const PRICE_SETTINGS_STORAGE_KEY = "ePulsakuPriceSettings";

// The productIdentifier key will be namespaced, e.g., "digiflazz::XYZ123" or "tokovoucher::ABC789"
export interface PriceSettings {
  [namespacedProductIdentifier: string]: number;
}

function getNamespacedProductIdentifier(provider: 'digiflazz' | 'tokovoucher', productCode: string): string {
  return `${provider}::${productCode}`;
}

export function getPriceSettings(): PriceSettings {
  if (typeof window === "undefined") return {};
  const storedSettings = localStorage.getItem(PRICE_SETTINGS_STORAGE_KEY);
  if (storedSettings) {
    try {
      return JSON.parse(storedSettings);
    } catch (e) {
      console.error("Error parsing price settings from localStorage", e);
      return {};
    }
  }
  return {};
}

export function savePriceSettings(settings: PriceSettings): void { // settings keys should be namespaced
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Error saving price settings to localStorage", e);
  }
}

export function getCustomSellingPrice(productCode: string, provider: 'digiflazz' | 'tokovoucher'): number | null {
  const settings = getPriceSettings();
  const namespacedKey = getNamespacedProductIdentifier(provider, productCode);
  if (settings && typeof settings[namespacedKey] === 'number' && settings[namespacedKey] > 0) {
    return settings[namespacedKey];
  }
  return null;
}

/**
 * Calculates the effective selling price for a product.
 * It first checks for a custom price in localStorage. If not found, it applies a default markup.
 * This is a client-side function.
 * @param productCode The SKU or code of the product.
 * @param provider The provider of the product ('digiflazz' or 'tokovoucher').
 * @param costPrice The base cost of the product.
 * @returns The calculated selling price.
 */
export function getEffectiveSellingPrice(
  productCode: string,
  provider: 'digiflazz' | 'tokovoucher',
  costPrice: number
): number {
  const customPrice = getCustomSellingPrice(productCode, provider);
  if (customPrice) {
    return customPrice;
  }
  // Default markup logic if no custom price is set
  if (costPrice < 20000) return costPrice + 1000;
  if (costPrice <= 50000) return costPrice + 1500;
  return costPrice + 2000;
}
