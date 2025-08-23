
'use server';
/**
 * @fileOverview A Genkit flow for inquiring Honkai Star Rail nickname using Codashop API.
 *
 * - inquireHonkaiStarRailNickname - A function that calls the Honkai Star Rail nickname inquiry flow.
 * - InquireHonkaiStarRailNicknameInput - The input type for the function.
 * - InquireHonkaiStarRailNicknameOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const HonkaiStarRailRegionSchema = z.enum(["Asia", "America", "Europe", "TW, HK, MO"]); // User-facing region names
export type HonkaiStarRailRegion = z.infer<typeof HonkaiStarRailRegionSchema>;

const InquireHonkaiStarRailNicknameInputSchema = z.object({
  userId: z.string().min(5, "User ID must be at least 5 characters").describe('The Honkai Star Rail User ID.'),
  region: HonkaiStarRailRegionSchema.describe('The game server region (Asia, America, Europe, TW, HK, MO).'),
});
export type InquireHonkaiStarRailNicknameInput = z.infer<typeof InquireHonkaiStarRailNicknameInputSchema>;

const InquireHonkaiStarRailNicknameOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the nickname inquiry was successful.'),
  nickname: z.string().optional().describe('The Honkai Star Rail nickname if found.'),
  message: z.string().optional().describe('An optional message, e.g., error message or status message.'),
  rawResponse: z.any().optional().describe('The raw response data from Codashop for debugging.'),
});
export type InquireHonkaiStarRailNicknameOutput = z.infer<typeof InquireHonkaiStarRailNicknameOutputSchema>;

// Mapping from user-friendly region name to Codashop's zoneId
const honkaiStarRailZoneIdMapping: Record<HonkaiStarRailRegion, string> = {
  "Asia": "prod_official_asia",
  "America": "prod_official_usa",
  "Europe": "prod_official_eur",
  "TW, HK, MO": "prod_official_cht", // Based on PHP 'Cht' -> 'prod_official_cht'
};


export async function inquireHonkaiStarRailNickname(input: InquireHonkaiStarRailNicknameInput): Promise<InquireHonkaiStarRailNicknameOutput> {
  return inquireHonkaiStarRailNicknameFlow(input);
}

const inquireHonkaiStarRailNicknameFlow = ai.defineFlow(
  {
    name: 'inquireHonkaiStarRailNicknameFlow',
    inputSchema: InquireHonkaiStarRailNicknameInputSchema,
    outputSchema: InquireHonkaiStarRailNicknameOutputSchema,
  },
  async (input) => {
    const codashopApiUrl = 'https://order-sg.codashop.com/initPayment.action';

    const apiZoneId = honkaiStarRailZoneIdMapping[input.region];
    if (!apiZoneId) {
      return {
        isSuccess: false,
        message: `Invalid region provided: ${input.region}. Supported regions are Asia, America, Europe, TW, HK, MO.`,
      };
    }

    const datePart = new Date().toLocaleDateString('en-CA');
    const randomPart = Math.floor(Math.random() * 1000);
    const nonce = `${datePart.replace(/-/g, '/')}-${randomPart}`;

    const postData = {
      'voucherPricePoint.id': 855424, // From PHP example for HSR
      'voucherPricePoint.price': 79000.0, // From PHP example
      'voucherPricePoint.variablePrice': 0,
      'n': nonce,
      'email': '',
      'userVariablePrice': 0,
      'order.data.profile': 'eyJuYW1lIjoiICIsImRhdGVvZmJpcnRoIjoiIiwiaWRfbm8iOiIifQ==',
      'user.userId': input.userId,
      'user.zoneId': apiZoneId, // Use mapped zoneId
      'msisdn': '',
      'voucherTypeName': 'HONKAI_STAR_RAIL',
      'shopLang': 'id_ID',
      'voucherTypeId': 327, // From PHP example
      'gvtId': 460,       // From PHP example
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
        console.error('Codashop API HTTP error response (HSR Nickname):', responseData);
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

        // HSR typically uses confirmationFields.username
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
            console.warn("Could not parse nickname from 'result' field for HSR:", e);
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
          return {
            isSuccess: true, 
            nickname: undefined, 
            message: 'User ID/Region found, but nickname is not available in the response or is in an unexpected format.',
            rawResponse: responseData,
          };
        }
      } else {
        console.error('Codashop API returned an error (HSR Nickname):', responseData);
        return {
          isSuccess: false,
          message: responseData.errorMsg || responseData.message || 'Invalid User ID/Region or unknown error.',
          rawResponse: responseData,
        };
      }
    } catch (error) {
      console.error('Error during Honkai Star Rail nickname inquiry:', error);
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
