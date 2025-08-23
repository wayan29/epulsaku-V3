
'use server';
/**
 * @fileOverview A Genkit flow for inquiring Genshin Impact nickname using Codashop API.
 *
 * - inquireGenshinImpactNickname - A function that calls the Genshin Impact nickname inquiry flow.
 * - InquireGenshinImpactNicknameInput - The input type for the function.
 * - InquireGenshinImpactNicknameOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// User-facing server names
const genshinImpactServerRegions = ["Asia", "America", "Europe", "TW, HK, MO"] as const;
const GenshinImpactServerRegionSchema = z.enum(genshinImpactServerRegions);

const InquireGenshinImpactNicknameInputSchema = z.object({
  userId: z.string().min(5, "User ID must be at least 5 characters").describe('The Genshin Impact User ID.'),
  // User will select "Asia", "America", etc. This will be mapped to API values.
  zoneId: GenshinImpactServerRegionSchema.describe('The Genshin Impact Server (Asia, America, Europe, TW, HK, MO).'),
});
export type InquireGenshinImpactNicknameInput = z.infer<typeof InquireGenshinImpactNicknameInputSchema>;

const InquireGenshinImpactNicknameOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the nickname inquiry was successful.'),
  nickname: z.string().optional().describe('The Genshin Impact nickname if found.'),
  message: z.string().optional().describe('An optional message, e.g., error message or status message.'),
  rawResponse: z.any().optional().describe('The raw response data from Codashop for debugging.'),
});
export type InquireGenshinImpactNicknameOutput = z.infer<typeof InquireGenshinImpactNicknameOutputSchema>;

// Mapping from user-friendly server name to Codashop's API zoneId
const genshinImpactApiZoneIdMapping: Record<typeof genshinImpactServerRegions[number], string> = {
  "Asia": "os_asia",
  "America": "os_usa",
  "Europe": "os_euro", // As per user clarification for API format
  "TW, HK, MO": "os_cht",
};

export async function inquireGenshinImpactNickname(input: InquireGenshinImpactNicknameInput): Promise<InquireGenshinImpactNicknameOutput> {
  return inquireGenshinImpactNicknameFlow(input);
}

const inquireGenshinImpactNicknameFlow = ai.defineFlow(
  {
    name: 'inquireGenshinImpactNicknameFlow',
    inputSchema: InquireGenshinImpactNicknameInputSchema,
    outputSchema: InquireGenshinImpactNicknameOutputSchema,
  },
  async (input) => {
    const codashopApiUrl = 'https://order-sg.codashop.com/initPayment.action';

    const apiZoneId = genshinImpactApiZoneIdMapping[input.zoneId];
    if (!apiZoneId) {
      // This case should ideally be prevented by Zod enum, but as a safeguard:
      return {
        isSuccess: false,
        message: `Invalid server region provided: ${input.zoneId}. Supported regions are ${genshinImpactServerRegions.join(', ')}.`,
      };
    }

    const datePart = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const randomPart = Math.floor(Math.random() * 1000);
    const nonce = `${datePart.replace(/-/g, '/')}-${randomPart}`;

    const postData = {
      'voucherPricePoint.id': 223412, // From PHP example for Genshin Impact
      'voucherPricePoint.price': 81000.0, // From PHP example
      'voucherPricePoint.variablePrice': 0,
      'n': nonce,
      'email': '',
      'userVariablePrice': 0,
      'order.data.profile': 'eyJuYW1lIjoiICIsImRhdGVvZmJpcnRoIjoiIiwiaWRfbm8iOiIifQ==',
      'user.userId': input.userId,
      'user.zoneId': apiZoneId, // Use mapped API zoneId
      'msisdn': '',
      'voucherTypeName': 'GENSHIN_IMPACT',
      'shopLang': 'id_ID',
      'voucherTypeId': 149, // From PHP example
      'gvtId': 183,       // From PHP example
      'checkoutId': '',
      'affiliateTrackingId': '',
      'impactClickId': '',
      'anonymousId': ''
    };

    try {
      const response = await fetch(codashopApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.codashop.com',
          'Referer': 'https://www.codashop.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        },
        body: JSON.stringify(postData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Codashop API HTTP error response (GI Nickname):', responseData);
        const errorMessage = responseData?.errorMsg || responseData?.message || `Service request failed: ${response.status} ${response.statusText}`;
        return {
          isSuccess: false,
          message: errorMessage,
          rawResponse: responseData,
        };
      }

      if (responseData.RESULT_CODE === '10001' || responseData.resultCode === '10001') {
        return {
          isSuccess: false,
          message: 'Too many attempts to check nickname. Please wait a moment and try again.',
          rawResponse: responseData,
        };
      }
      
      if (responseData.success && !responseData.errorMsg) {
        let extractedNickname: string | undefined = undefined;

        // Genshin Impact typically uses confirmationFields.username
        if (responseData.confirmationFields?.username) {
            extractedNickname = decodeURIComponent(responseData.confirmationFields.username as string);
        } else if (responseData.result && typeof responseData.result === 'string') { // Fallback to result field
          try {
            const decodedResultString = decodeURIComponent(responseData.result);
            const resultData = JSON.parse(decodedResultString);
            if (resultData.username) { 
              extractedNickname = decodeURIComponent(resultData.username as string);
            }
          } catch (e) {
            console.warn("Could not parse nickname from 'result' field for GI:", e);
          }
        }

        if (extractedNickname) {
          return {
            isSuccess: true,
            nickname: extractedNickname,
            message: 'Nickname inquiry successful.',
            rawResponse: responseData,
          };
        } else {
          // API call was successful but nickname could not be extracted
          return {
            isSuccess: true, 
            nickname: undefined, 
            message: 'User ID/Server found, but nickname is not available in the response or is in an unexpected format.',
            rawResponse: responseData,
          };
        }
      } else {
        console.error('Codashop API returned an error (GI Nickname):', responseData);
        return {
          isSuccess: false,
          message: responseData.errorMsg || responseData.message || 'Invalid User ID/Server or unknown error.',
          rawResponse: responseData,
        };
      }
    } catch (error) {
      console.error('Error during Genshin Impact nickname inquiry:', error);
      let errorMessage = 'An unknown error occurred during nickname inquiry.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        isSuccess: false,
        message: `Service error: ${errorMessage}`,
      };
    }
  }
);
