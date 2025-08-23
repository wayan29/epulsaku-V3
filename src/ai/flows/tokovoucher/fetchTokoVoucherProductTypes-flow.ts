
'use server';
/**
 * @fileOverview Fetches product "jenis" (types/kinds) for a given operator from TokoVoucher.
 * - fetchTokoVoucherProductTypes
 * - TokoVoucherProductType
 * - FetchTokoVoucherProductTypesInput
 * - FetchTokoVoucherProductTypesOutput
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

const FetchTokoVoucherProductTypesInputSchema = z.object({
  operatorId: z.number().describe('The ID of the operator to fetch product types for.'),
});
export type FetchTokoVoucherProductTypesInput = z.infer<typeof FetchTokoVoucherProductTypesInputSchema>;

const TokoVoucherProductTypeSchema = z.object({
  id: z.number(),
  nama: z.string(),
  image: z.string().url().optional().nullable(),
});
export type TokoVoucherProductType = z.infer<typeof TokoVoucherProductTypeSchema>;

const FetchTokoVoucherProductTypesOutputSchema = z.object({
    isSuccess: z.boolean(),
    data: z.array(TokoVoucherProductTypeSchema).optional(),
    message: z.string().optional(),
});
export type FetchTokoVoucherProductTypesOutput = z.infer<typeof FetchTokoVoucherProductTypesOutputSchema>;

export async function fetchTokoVoucherProductTypes(input: FetchTokoVoucherProductTypesInput): Promise<FetchTokoVoucherProductTypesOutput> {
  return fetchTokoVoucherProductTypesFlow(input);
}

const fetchTokoVoucherProductTypesFlow = ai.defineFlow(
  {
    name: 'fetchTokoVoucherProductTypesFlow',
    inputSchema: FetchTokoVoucherProductTypesInputSchema,
    outputSchema: FetchTokoVoucherProductTypesOutputSchema,
  },
  async ({ operatorId }) => {
    const adminSettings = await getAdminSettingsFromDB();
    const memberCode = adminSettings.tokovoucherMemberCode;
    const signature = adminSettings.tokovoucherSignature;

    if (!memberCode || !signature) {
      return { isSuccess: false, message: 'TokoVoucher Member Code or Signature not configured.' };
    }

    const apiUrl = `https://api.tokovoucher.net/member/produk/jenis/list?member_code=${memberCode}&signature=${signature}&id=${operatorId}`;

    try {
      const response = await fetch(apiUrl);
      const responseData = await response.json();

      if (responseData.status && Number(responseData.status) === 1 && responseData.data) {
        const parsedData = z.array(TokoVoucherProductTypeSchema).parse(responseData.data);
        return { isSuccess: true, data: parsedData };
      } else {
        return { isSuccess: false, message: responseData.error_msg || 'Failed to fetch product types.' };
      }
    } catch (error) {
      console.error('Error fetching TokoVoucher product types:', error);
      return { isSuccess: false, message: error instanceof Error ? error.message : 'Unknown error.' };
    }
  }
);
