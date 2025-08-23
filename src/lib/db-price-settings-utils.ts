// src/lib/db-price-settings-utils.ts
'use server';

import { readDb, writeDb } from './mongodb'; // Now json-db helpers
import { getUserByUsername, verifyUserPassword } from './user-utils';

export interface PriceSettings {
  [namespacedProductIdentifier: string]: number;
}

interface StoredPriceSettingsDoc {
  settings: PriceSettings;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

const PRICE_SETTINGS_DB = 'price_settings';

export async function fetchPriceSettingsFromDB(): Promise<PriceSettings> {
  try {
    const configDoc = await readDb<StoredPriceSettingsDoc>(PRICE_SETTINGS_DB);
    return configDoc?.settings || {};
  } catch (error) {
    console.error("Error fetching price settings from DB:", error);
    return {};
  }
}

export async function storePriceSettingsInDB(
  settingsToSave: PriceSettings,
  adminUsername: string,
  adminPasswordConfirmation: string
): Promise<{ success: boolean; message: string }> {
  try {
    const adminUser = await getUserByUsername(adminUsername);
    if (!adminUser || !adminUser.hashedPassword) {
      return { success: false, message: "Admin user not found or password not set." };
    }
    const isPasswordValid = await verifyUserPassword(adminPasswordConfirmation, adminUser.hashedPassword);
    if (!isPasswordValid) {
      return { success: false, message: "Incorrect admin password. Price settings not saved." };
    }

    const validSettings: PriceSettings = {};
    for (const key in settingsToSave) {
      if (Object.prototype.hasOwnProperty.call(settingsToSave, key)) {
        const price = settingsToSave[key];
        if (typeof price === 'number' && price > 0 && key.includes('::')) {
          validSettings[key] = price;
        }
      }
    }
    
    const docToSave: StoredPriceSettingsDoc = {
        settings: validSettings,
        lastUpdatedBy: adminUsername,
        lastUpdatedAt: new Date(),
    };

    await writeDb(PRICE_SETTINGS_DB, docToSave);

    return { success: true, message: "Price settings saved successfully." };
  } catch (error) {
    console.error("Error saving price settings to DB:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to save price settings: ${message}` };
  }
}

export async function fetchSingleCustomPriceFromDB(productCode: string, provider: 'digiflazz' | 'tokovoucher'): Promise<number | null> {
  try {
    const allSettings = await fetchPriceSettingsFromDB();
    const namespacedKey = `${provider}::${productCode}`;
    if (allSettings && typeof allSettings[namespacedKey] === 'number' && allSettings[namespacedKey] > 0) {
      return allSettings[namespacedKey];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching single custom price for ${provider}::${productCode} from DB:`, error);
    return null;
  }
}
