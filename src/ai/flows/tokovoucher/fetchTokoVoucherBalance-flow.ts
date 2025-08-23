
'use server';
/**
 * @fileOverview A Genkit flow for fetching the TokoVoucher account balance.
 *
 * - fetchTokoVoucherBalance - A function that calls the TokoVoucher balance fetching flow.
 * - FetchTokoVoucherBalanceOutput - The return type for the fetchTokoVoucherBalance function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

const FetchTokoVoucherBalanceOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the balance fetch was successful.'),
  nama: z.string().optional().describe('The name of the member account.'),
  saldo: z.number().optional().describe('The current account balance in TokoVoucher.'),
  message: z.string().optional().describe('An optional message, e.g., error message or success message.'),
});
export type FetchTokoVoucherBalanceOutput = z.infer<typeof FetchTokoVoucherBalanceOutputSchema>;

export async function fetchTokoVoucherBalance(): Promise<FetchTokoVoucherBalanceOutput> {
  return fetchTokoVoucherBalanceFlow();
}

const fetchTokoVoucherBalanceFlow = ai.defineFlow(
  {
    name: 'fetchTokoVoucherBalanceFlow',
    inputSchema: z.void(),
    outputSchema: FetchTokoVoucherBalanceOutputSchema,
  },
  async () => {
    const adminSettings = await getAdminSettingsFromDB();
    const memberCode = adminSettings.tokovoucherMemberCode;
    const signature = adminSettings.tokovoucherSignature;
    
    if (!memberCode || !signature) {
      return {
        isSuccess: false,
        message: 'Error: TokoVoucher Member Code or Signature is not configured in Admin Settings.',
      };
    }
    
    const apiUrl = `https://api.tokovoucher.net/member?member_code=${memberCode}&signature=${signature}`;

    try {
      const response = await fetch(apiUrl);
      const responseData = await response.json();

      if (responseData.status && Number(responseData.status) === 1 && responseData.data) {
        return {
          isSuccess: true,
          nama: responseData.data.nama,
          saldo: responseData.data.saldo,
          message: 'Balance fetched successfully.',
        };
      } else {
        return {
          isSuccess: false,
          message: `TokoVoucher API Error: ${responseData.error_msg || responseData.message || 'Unknown error'}`,
        };
      }
    } catch (error) {
      console.error('Error fetching TokoVoucher balance:', error);
      let errorMessage = 'An unknown error occurred while fetching balance from TokoVoucher.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        isSuccess: false,
        message: `Client-side error: ${errorMessage}`,
      };
    }
  }
);
