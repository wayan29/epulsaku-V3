
'use server';
/**
 * @fileOverview A Genkit flow for creating a deposit ticket with TokoVoucher.
 *
 * - createTokoVoucherDeposit - A function that calls the TokoVoucher deposit ticket creation flow.
 * - CreateTokoVoucherDepositInput - The input type for the function.
 * - CreateTokoVoucherDepositOutput - The return type for the function.
 * - TokoVoucherPaymentMethodCode - Enum for payment method codes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

// Define payment method codes as a const array for pure TypeScript type derivation
const tokoVoucherPaymentMethodCodes = ["bca", "qris", "briva"] as const;
// Export the enum as a union of string literals
export type TokoVoucherPaymentMethodCode = (typeof tokoVoucherPaymentMethodCodes)[number];

// Define the Zod schema for BankEnum internally using the bankValues
const TokoVoucherPaymentMethodCodeSchema = z.enum(tokoVoucherPaymentMethodCodes);


const CreateTokoVoucherDepositInputSchema = z.object({
  nominal: z.number().min(10000, "Minimum deposit amount is Rp 10,000").describe('The amount of deposit requested.'),
  kode_bayar: TokoVoucherPaymentMethodCodeSchema.describe('The payment method code (bca, qris, briva).'),
});
export type CreateTokoVoucherDepositInput = z.infer<typeof CreateTokoVoucherDepositInputSchema>;

const TokoVoucherDepositDataSchema = z.object({
    status: z.string(), // e.g., "SUKSES"
    metode: z.string(), // e.g., "QRIS All Payment", "Bank Bri"
    pay: z.string(), // QRIS URL or VA number or Bank Account Number
    pay_name: z.string().optional().nullable(), // Account holder name for bank transfers
    nominal: z.number(),
    total_transfer: z.number(),
    kode_unik: z.number().optional().nullable(),
    biaya_admin: z.number().optional().nullable(),
    created: z.string(), // Date string e.g., "2024-04-18"
    expired_at: z.string(), // Datetime string e.g., "2024-04-19 00:00:00"
});

const CreateTokoVoucherDepositOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the deposit ticket request was successful.'),
  message: z.string().optional().describe('An optional message, e.g., error message or success message.'),
  rc: z.number().optional().describe('Response code from TokoVoucher.'),
  data: TokoVoucherDepositDataSchema.optional().describe('Details of the deposit ticket if successful.'),
  rawResponse: z.any().optional().describe('The raw response data from TokoVoucher for debugging.'),
});
export type CreateTokoVoucherDepositOutput = z.infer<typeof CreateTokoVoucherDepositOutputSchema>;


export async function createTokoVoucherDeposit(input: CreateTokoVoucherDepositInput): Promise<CreateTokoVoucherDepositOutput> {
  return createTokoVoucherDepositFlow(input);
}

const createTokoVoucherDepositFlow = ai.defineFlow(
  {
    name: 'createTokoVoucherDepositFlow',
    inputSchema: CreateTokoVoucherDepositInputSchema,
    outputSchema: CreateTokoVoucherDepositOutputSchema,
  },
  async (input) => {
    const adminSettings = await getAdminSettingsFromDB();
    const memberCode = adminSettings.tokovoucherMemberCode;
    const secretKey = adminSettings.tokovoucherKey; // This is the 'secret' key

    if (!memberCode || !secretKey) {
      return {
        isSuccess: false,
        message: 'Error: TokoVoucher Member Code or Key (Secret) is not configured in Admin Settings.',
        rc: 500, // Internal error indicator
      };
    }

    const apiUrl = `https://api.tokovoucher.net/v1/deposit?member_code=${memberCode}&secret=${secretKey}&nominal=${input.nominal}&kode=${input.kode_bayar}`;

    try {
      const response = await fetch(apiUrl, { method: 'GET' });
      const responseData = await response.json();

      if (responseData.status && Number(responseData.status) === 1 && responseData.data) {
        // Successfully created deposit ticket
        return {
          isSuccess: true,
          message: responseData.message || 'Deposit ticket created successfully.',
          rc: responseData.rc,
          data: TokoVoucherDepositDataSchema.parse(responseData.data),
          rawResponse: responseData,
        };
      } else {
        // API returned an error (status 0 or other)
        return {
          isSuccess: false,
          message: responseData.error_msg || responseData.message || 'Failed to create deposit ticket at TokoVoucher.',
          rc: responseData.rc || 500,
          rawResponse: responseData,
        };
      }
    } catch (error) {
      console.error('Error during TokoVoucher deposit request:', error);
      let errorMessage = 'An unknown error occurred during the deposit request.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        isSuccess: false,
        message: `Client-side error: ${errorMessage}`,
        rc: 500, // Client-side error indicator
      };
    }
  }
);
