
'use server';
/**
 * @fileOverview A Genkit flow for fetching the Digiflazz account balance.
 *
 * - fetchDigiflazzBalance - A function that calls the Digiflazz balance fetching flow.
 * - FetchDigiflazzBalanceOutput - The return type for the fetchDigiflazzBalance function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import crypto from 'crypto';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils'; // Import new settings utility

const FetchDigiflazzBalanceOutputSchema = z.object({
  balance: z.number().describe('The current account balance in Digiflazz.'),
});
export type FetchDigiflazzBalanceOutput = z.infer<typeof FetchDigiflazzBalanceOutputSchema>;

// This is the function you'll call from your client-side code.
export async function fetchDigiflazzBalance(): Promise<FetchDigiflazzBalanceOutput> {
  return fetchDigiflazzBalanceFlow();
}

const fetchDigiflazzBalanceFlow = ai.defineFlow(
  {
    name: 'fetchDigiflazzBalanceFlow',
    inputSchema: z.void(), // No input needed from client for fetching balance
    outputSchema: FetchDigiflazzBalanceOutputSchema,
  },
  async () => {
    const adminSettings = await getAdminSettingsFromDB();
    const username = adminSettings.digiflazzUsername;
    const apiKey = adminSettings.digiflazzApiKey;
    const digiflazzApiUrl = 'https://api.digiflazz.com/v1/cek-saldo'; 

    if (!username || !apiKey) {
      throw new Error('Digiflazz username or API key is not configured in Admin Settings.');
    }

    const signaturePayload = `${username}${apiKey}depo`; 
    const sign = crypto.createHash('md5').update(signaturePayload).digest('hex');

    const requestBody = {
      cmd: 'deposit', 
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
        console.error('Digiflazz API HTTP error response (balance check):', errorBody);
        throw new Error(`Digiflazz API request failed (balance check): ${response.status} ${response.statusText}. Details: ${errorBody}`);
      }

      const responseData = await response.json();
      
      // Check for application-level errors within responseData.data if it's an object
      if (responseData.data && typeof responseData.data === 'object' && responseData.data.rc && String(responseData.data.rc) !== '00') {
        console.error('Digiflazz API returned an error in data object (balance check):', responseData.data);
        throw new Error(`Digiflazz API Error (balance): ${responseData.data.message || 'Unknown error'} (RC: ${responseData.data.rc})`);
      }
      // Check for application-level errors at the root of responseData
      if (responseData.rc && String(responseData.rc) !== '00') {
         console.error('Digiflazz API returned a root-level error (balance check):', responseData);
         throw new Error(`Digiflazz API Error (balance): ${responseData.message || 'Unknown error'} (RC: ${responseData.rc})`);
      }

      // Expected success structure for balance check
      if (responseData && responseData.data && typeof responseData.data.deposit === 'number') {
        return { balance: responseData.data.deposit };
      } else {
        console.error('Unexpected Digiflazz API response structure (balance check):', responseData);
        // Log the actual response if it's not the expected structure but no clear 'rc' error code was found
        throw new Error('Unexpected response structure from Digiflazz API when checking balance.');
      }
    } catch (error) {
      console.error('Error fetching Digiflazz balance:', error);
      if (error instanceof Error && error.message.startsWith('Digiflazz API Error')) {
        throw error; // Re-throw specific Digiflazz API errors
      }
      if (error instanceof Error) {
        // Check for the specific missing credentials error message
        if (error.message === 'Digiflazz username or API key is not configured in Admin Settings.') {
            throw error;
        }
        throw new Error(`Failed to fetch balance from Digiflazz: ${error.message}`);
      }
      throw new Error('An unknown error occurred while fetching balance from Digiflazz.');
    }
  }
);
