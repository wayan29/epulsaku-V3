
'use server';
/**
 * @fileOverview A Genkit flow for checking the status of a TokoVoucher transaction.
 *
 * - checkTokoVoucherTransactionStatus - A function that calls the TokoVoucher transaction status check flow.
 * - CheckTokoVoucherTransactionStatusInput - The input type for the function.
 * - CheckTokoVoucherTransactionStatusOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import crypto from 'crypto';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

const CheckTokoVoucherTransactionStatusInputSchema = z.object({
  ref_id: z.string().describe('The unique reference ID of the transaction to check.'),
});
export type CheckTokoVoucherTransactionStatusInput = z.infer<typeof CheckTokoVoucherTransactionStatusInputSchema>;

// Updated schema based on TokoVoucher documentation samples
const CheckTokoVoucherTransactionStatusOutputSchema = z.object({
  isSuccess: z.boolean().describe('Indicates if the API call to check status itself was successful (i.e., not an API-level error like invalid signature).'),
  status: z.enum(["Sukses", "Pending", "Gagal"]).optional().describe('The actual transaction status from TokoVoucher (Sukses, Pending, Gagal). Undefined if API call failed.'),
  message: z.string().optional().describe('Message from TokoVoucher, can be an error message or status details.'),
  sn: z.string().optional().nullable().describe('Serial number if the transaction is successful and provides one, or error detail on failure.'),
  ref_id: z.string().optional().describe('The reference ID of the transaction, returned by API.'),
  trx_id: z.string().optional().describe('The transaction ID from TokoVoucher.'),
  produk: z.string().optional().nullable().describe('Product code.'),
  sisa_saldo: z.number().optional().nullable().describe('Remaining balance.'),
  price: z.number().optional().nullable().describe('Price of the product.'),
  rawResponse: z.any().optional().describe('The raw response data from TokoVoucher for debugging.'),
  error_msg: z.string().optional().describe('Error message from API if root API status is 0 (e.g., "Ip Not Allow", "Signature Invalid").'),
});
export type CheckTokoVoucherTransactionStatusOutput = z.infer<typeof CheckTokoVoucherTransactionStatusOutputSchema>;

export async function checkTokoVoucherTransactionStatus(input: CheckTokoVoucherTransactionStatusInput): Promise<CheckTokoVoucherTransactionStatusOutput> {
  return checkTokoVoucherTransactionStatusFlow(input);
}

const checkTokoVoucherTransactionStatusFlow = ai.defineFlow(
  {
    name: 'checkTokoVoucherTransactionStatusFlow',
    inputSchema: CheckTokoVoucherTransactionStatusInputSchema,
    outputSchema: CheckTokoVoucherTransactionStatusOutputSchema,
  },
  async ({ ref_id }) => {
    const adminSettings = await getAdminSettingsFromDB();
    const memberCode = adminSettings.tokovoucherMemberCode;
    const secretKey = adminSettings.tokovoucherKey; // This is the 'secret'

    if (!memberCode || !secretKey) {
      return {
        isSuccess: false,
        message: 'Error: TokoVoucher Member Code or Key (Secret) is not configured in Admin Settings.',
        error_msg: 'TokoVoucher Member Code or Key (Secret) is not configured.',
        status: undefined,
      };
    }

    const signature = crypto.createHash('md5').update(`${memberCode}:${secretKey}:${ref_id}`).digest('hex');
    const apiUrl = 'https://api.tokovoucher.net/v1/transaksi/status';

    const requestBody = {
      ref_id: ref_id,
      member_code: memberCode,
      signature: signature,
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      // Case 1: API call itself failed (e.g. invalid signature, IP block)
      // TokoVoucher returns root status 0 (number or string) for these API errors.
      if (responseData.status === 0 || responseData.status === "0") {
        return {
          isSuccess: false, // API call to check status FAILED
          status: undefined, // Transaction status is unknown because the check failed
          message: responseData.error_msg || 'TokoVoucher API request to check status failed.',
          error_msg: responseData.error_msg,
          rawResponse: responseData,
        };
      }

      // Case 2: API call to check status was successful.
      // The root `responseData.status` (string) now indicates the transaction's actual status.
      if (typeof responseData.status === 'string') {
        const transactionStatusLower = responseData.status.toLowerCase();
        let parsedStatus: "Sukses" | "Pending" | "Gagal";

        if (transactionStatusLower === "sukses") {
            parsedStatus = "Sukses";
        } else if (transactionStatusLower === "pending") {
            parsedStatus = "Pending";
        } else if (transactionStatusLower === "gagal") {
            parsedStatus = "Gagal";
        } else {
            // Unexpected transaction status string
            console.warn(`Unexpected transaction status string from TokoVoucher: ${responseData.status} for ref_id: ${ref_id}`);
            return {
                isSuccess: false, // Treat as failure to get a valid status
                status: undefined,
                message: `Received unexpected transaction status from TokoVoucher: ${responseData.status}`,
                error_msg: 'Unexpected transaction status value from API.',
                rawResponse: responseData,
            };
        }
        
        return {
          isSuccess: true, // API call to check status SUCCEEDED
          status: parsedStatus,
          message: responseData.message,
          sn: responseData.sn || null,
          ref_id: responseData.ref_id, // API returns this as well
          trx_id: responseData.trx_id,
          produk: responseData.produk || null,
          sisa_saldo: responseData.sisa_saldo,
          price: responseData.price,
          rawResponse: responseData,
        };
      } else {
        // Case 3: API call was likely successful (root status wasn't 0), but responseData.status is not a string.
        // This indicates an unexpected response structure from TokoVoucher.
        console.error('Unexpected TokoVoucher API response structure (status check):', responseData);
        return {
          isSuccess: false, 
          status: undefined,
          message: 'TokoVoucher API response structure for status check is unexpected.',
          error_msg: 'Unexpected response structure from TokoVoucher.',
          rawResponse: responseData,
        };
      }
    } catch (error) {
      console.error('Error during TokoVoucher status check request:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        isSuccess: false,
        status: undefined,
        message: `Client-side error: ${errorMessage}`,
        error_msg: `Client-side error: ${errorMessage}`,
      };
    }
  }
);
