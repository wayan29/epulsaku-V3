
'use server';
/**
 * @fileOverview A Genkit flow for fetching product list from Digiflazz API.
 * Implements a simple in-memory cache that refreshes every 15 seconds.
 *
 * - fetchDigiflazzProducts - A function that calls the Digiflazz product fetching flow.
 * - DigiflazzProduct - The type for a single Digiflazz product.
 * - FetchDigiflazzProductsInput - The input type for the fetchDigiflazzProducts function.
 * - FetchDigiflazzProductsOutput - The return type for the fetchDigiflazzProducts function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import crypto from 'crypto';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils'; // Import new settings utility

// Define Zod schema for DigiflazzProduct based on the existing interface
const DigiflazzProductSchema = z.object({
  product_name: z.string(),
  category: z.string(),
  brand: z.string(),
  type: z.string().optional().nullable(), // Made nullable as API might send null
  seller_name: z.string(),
  price: z.number(),
  buyer_sku_code: z.string(),
  buyer_product_status: z.boolean(),
  seller_product_status: z.boolean(),
  unlimited_stock: z.boolean().optional().nullable(), // Made nullable
  stock: z.number().optional().nullable(), // Made nullable
  multi: z.boolean().optional().nullable(), // Made nullable
  start_cut_off: z.string().optional().nullable(), // Made nullable
  end_cut_off: z.string().optional().nullable(), // Made nullable
  desc: z.string().optional().nullable(), // Made nullable
});

export type DigiflazzProduct = z.infer<typeof DigiflazzProductSchema>;

const FetchDigiflazzProductsInputSchema = z.object({
  forceRefresh: z.boolean().optional().default(false).describe('If true, bypasses the cache and fetches directly from the API.'),
});
export type FetchDigiflazzProductsInput = z.infer<typeof FetchDigiflazzProductsInputSchema>;

const FetchDigiflazzProductsOutputSchema = z.array(DigiflazzProductSchema);
export type FetchDigiflazzProductsOutput = z.infer<typeof FetchDigiflazzProductsOutputSchema>;

// In-memory cache variables
let cachedProducts: FetchDigiflazzProductsOutput | null = null;
let lastFetchTimestamp: number | null = null;
const CACHE_DURATION_MS = 15 * 1000; // 15 seconds

// This is the function you'll call from your client-side code.
export async function fetchDigiflazzProducts(input?: FetchDigiflazzProductsInput): Promise<FetchDigiflazzProductsOutput> {
  return fetchDigiflazzProductsFlow(input || { forceRefresh: false });
}

const fetchDigiflazzProductsFlow = ai.defineFlow(
  {
    name: 'fetchDigiflazzProductsFlow',
    inputSchema: FetchDigiflazzProductsInputSchema,
    outputSchema: FetchDigiflazzProductsOutputSchema,
  },
  async (input) => {
    const now = Date.now();

    // Check cache first, only if not forceRefresh
    if (!input.forceRefresh && cachedProducts && lastFetchTimestamp && (now - lastFetchTimestamp < CACHE_DURATION_MS)) {
      console.log('Returning Digiflazz products from cache.');
      return cachedProducts;
    }

    if (input.forceRefresh) {
      console.log('Force refreshing Digiflazz products from API.');
    } else {
      console.log('Fetching Digiflazz products from API (cache stale or empty).');
    }
    
    const adminSettings = await getAdminSettingsFromDB();
    const username = adminSettings.digiflazzUsername;
    const apiKey = adminSettings.digiflazzApiKey;
    const digiflazzApiUrl = 'https://api.digiflazz.com/v1/price-list';

    if (!username || !apiKey) {
      throw new Error('Digiflazz username or API key is not configured in Admin Settings.');
    }

    const signaturePayload = `${username}${apiKey}pricelist`;
    const sign = crypto.createHash('md5').update(signaturePayload).digest('hex');

    const requestBody = {
      cmd: 'pricelist',
      username: username,
      sign: sign,
    };

    try {
      const response = await fetch(digiflazzApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Digiflazz API HTTP error response (products):', errorBody);
        throw new Error(`Digiflazz API request failed (products): ${response.status} ${response.statusText}. Details: ${errorBody}`);
      }

      const responseData = await response.json();

      if (responseData.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data) && responseData.data.rc && String(responseData.data.rc) !== '00') {
        console.error('Digiflazz API returned an error in data object (products):', responseData.data);
        throw new Error(`Digiflazz API Error (products): ${responseData.data.message || 'Unknown error'} (RC: ${responseData.data.rc})`);
      }
      if (responseData.rc && String(responseData.rc) !== '00') {
         console.error('Digiflazz API returned a root-level error (products):', responseData);
         throw new Error(`Digiflazz API Error (products): ${responseData.message || 'Unknown error'} (RC: ${responseData.rc})`);
      }

      if (responseData && responseData.data && Array.isArray(responseData.data)) {
        const products = responseData.data.map((product: any, index: number) => {
          try {
            const cleanedProduct = {
              ...product,
              type: product.type === undefined ? null : product.type,
              unlimited_stock: product.unlimited_stock === undefined ? null : product.unlimited_stock,
              stock: product.stock === undefined ? null : product.stock,
              multi: product.multi === undefined ? null : product.multi,
              start_cut_off: product.start_cut_off === undefined ? null : product.start_cut_off,
              end_cut_off: product.end_cut_off === undefined ? null : product.end_cut_off,
              desc: product.desc === undefined ? null : product.desc,
            };
            return DigiflazzProductSchema.parse(cleanedProduct);
          } catch (parseError) {
            console.error(`Failed to parse Digiflazz product at index ${index}:`, product, parseError);
            throw new Error(`Failed to parse a product from Digiflazz (index ${index}): ${(parseError as Error).message}`);
          }
        });

        cachedProducts = products;
        lastFetchTimestamp = Date.now();
        console.log('Digiflazz products cache updated.');

        return products;
      } else {
        console.error('Unexpected Digiflazz API response structure for products:', responseData);
        throw new Error('Unexpected response structure from Digiflazz API when fetching products.');
      }
    } catch (error) {
      console.error('Error fetching Digiflazz products:', error);
      if (error instanceof Error && error.message === 'Digiflazz username or API key is not configured in Admin Settings.') {
          throw error;
      }
      if (error instanceof Error && (error.message.startsWith('Digiflazz API Error') || error.message.startsWith('Failed to parse a product') || error.message.startsWith('Unexpected response structure'))) {
        throw error; 
      }
      if (error instanceof Error) {
         throw new Error(`Failed to fetch products from Digiflazz: ${error.message}`);
      }
      throw new Error('An unknown error occurred while fetching products from Digiflazz.');
    }
  }
);
