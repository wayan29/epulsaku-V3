
'use server';
/**
 * @fileOverview A Genkit flow for creating a deposit ticket with Digiflazz.
 *
 * - createDigiflazzDepositTicket - A function that calls the Digiflazz deposit ticket creation flow.
 * - CreateDigiflazzDepositTicketInput - The input type for the function.
 * - CreateDigiflazzDepositTicketOutput - The return type for the function.
 * - BankEnum - The type for bank options.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import crypto from 'crypto';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils'; // Import new settings utility

// Define bank values as a const array for pure TypeScript type derivation
const bankValues = ["BCA", "MANDIRI", "BRI", "BNI"] as const;
// Export the BankEnum as a union of string literals
export type BankEnum = (typeof bankValues)[number];

// Define the Zod schema for BankEnum internally using the bankValues
const BankEnumSchema = z.enum(bankValues);

// Define Zod schemas internally
const CreateDigiflazzDepositTicketInputSchema = z.object({
  amount: z.number().min(10000, "Minimum deposit amount is Rp 10,000").describe('The amount of deposit requested.'),
  bank: BankEnumSchema.describe('The destination bank for the deposit (BCA, MANDIRI, BRI, or BNI).'),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters").describe('The name of the bank account owner making the transfer.'),
});
export type CreateDigiflazzDepositTicketInput = z.infer<typeof CreateDigiflazzDepositTicketInputSchema>;

const CreateDigiflazzDepositTicketOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the deposit ticket request was successful.'),
  rc: z.string().optional().describe('Response code from Digiflazz.'),
  finalAmount: z.number().optional().describe('The final amount that needs to be transferred.'),
  notes: z.string().optional().describe('The notes/ berita that must be included during transfer.'),
  message: z.string().optional().describe('An optional message, e.g., error message or success message.'),
  rawResponse: z.any().optional().describe('The raw response data from Digiflazz for debugging.'),
});
export type CreateDigiflazzDepositTicketOutput = z.infer<typeof CreateDigiflazzDepositTicketOutputSchema>;

// This is the function you'll call from your client-side code (via the dialog).
export async function createDigiflazzDepositTicket(input: CreateDigiflazzDepositTicketInput): Promise<CreateDigiflazzDepositTicketOutput> {
  return createDigiflazzDepositTicketFlow(input);
}

const createDigiflazzDepositTicketFlow = ai.defineFlow(
  {
    name: 'createDigiflazzDepositTicketFlow',
    inputSchema: CreateDigiflazzDepositTicketInputSchema,
    outputSchema: CreateDigiflazzDepositTicketOutputSchema,
  },
  async (input) => {
    const adminSettings = await getAdminSettingsFromDB();
    const username = adminSettings.digiflazzUsername;
    const apiKey = adminSettings.digiflazzApiKey;
    const digiflazzApiUrl = 'https://api.digiflazz.com/v1/deposit';

    if (!username || !apiKey) {
      return {
        isSuccess: false,
        message: 'Error: Digiflazz username or API key is not configured in Admin Settings.',
      };
    }

    // Signature for /v1/deposit is md5(username + apiKey + "deposit")
    const signaturePayload = `${username}${apiKey}deposit`; 
    const sign = crypto.createHash('md5').update(signaturePayload).digest('hex');

    const requestBody = {
      username: username,
      amount: input.amount,
      Bank: input.bank, // Digiflazz API expects "Bank" with capital B
      owner_name: input.ownerName,
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

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Digiflazz API HTTP error response (deposit):', responseData);
        const errorMessage = responseData?.data?.message || responseData?.message || `Digiflazz API request failed: ${response.status} ${response.statusText}`;
        return {
          isSuccess: false,
          message: `Error: ${errorMessage}`,
          rawResponse: responseData,
          rc: responseData?.data?.rc || responseData?.rc,
        };
      }

      // Check for application-level errors within responseData.data (e.g., rc != "00")
      if (responseData.data && responseData.data.rc && String(responseData.data.rc) !== '00') {
        console.error('Digiflazz API returned an error (deposit):', responseData.data);
        return {
          isSuccess: false,
          rc: responseData.data.rc,
          message: `Deposit request failed: ${responseData.data.message || 'Unknown Digiflazz error'} (RC: ${responseData.data.rc})`,
          rawResponse: responseData,
        };
      }

      // Expected success structure for deposit (rc: "00" and amount, notes exist)
      if (responseData.data && String(responseData.data.rc) === '00' && responseData.data.amount && responseData.data.notes) {
        return {
          isSuccess: true,
          rc: responseData.data.rc,
          finalAmount: responseData.data.amount,
          notes: responseData.data.notes,
          message: 'Deposit ticket created successfully. Please transfer the exact amount with the specified notes.',
          rawResponse: responseData,
        };
      } else {
        console.error('Unexpected Digiflazz API success response structure (deposit):', responseData);
        return {
          isSuccess: false,
          message: responseData?.data?.message || 'Unexpected response structure from Digiflazz API after successful RC.',
          rawResponse: responseData,
          rc: responseData?.data?.rc,
        };
      }
    } catch (error) {
      console.error('Error during Digiflazz deposit request:', error);
      let errorMessage = 'An unknown error occurred during the deposit request.';
      if (error instanceof Error) {
         if (error.message === 'Digiflazz username or API key is not configured in Admin Settings.') {
            return { isSuccess: false, message: error.message };
        }
        errorMessage = error.message;
      }
      return {
        isSuccess: false,
        message: `Client-side error: ${errorMessage}`,
      };
    }
  }
);
