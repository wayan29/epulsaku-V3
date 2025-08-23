
'use server';
/**
 * @fileOverview Fetches product operators for a given category from TokoVoucher.
 * - fetchTokoVoucherOperators
 * - TokoVoucherOperator
 * - FetchTokoVoucherOperatorsInput
 * - FetchTokoVoucherOperatorsOutput
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

const FetchTokoVoucherOperatorsInputSchema = z.object({
  categoryId: z.number().describe('The ID of the category to fetch operators for.'),
});
export type FetchTokoVoucherOperatorsInput = z.infer<typeof FetchTokoVoucherOperatorsInputSchema>;

const TokoVoucherOperatorSchema = z.object({
  id: z.number(),
  nama: z.string(),
  image: z.string().url().optional().nullable(),
  keterangan: z.string().optional().nullable(),
});
export type TokoVoucherOperator = z.infer<typeof TokoVoucherOperatorSchema>;

const FetchTokoVoucherOperatorsOutputSchema = z.object({
    isSuccess: z.boolean(),
    data: z.array(TokoVoucherOperatorSchema).optional(),
    message: z.string().optional(),
});
export type FetchTokoVoucherOperatorsOutput = z.infer<typeof FetchTokoVoucherOperatorsOutputSchema>;

export async function fetchTokoVoucherOperators(input: FetchTokoVoucherOperatorsInput): Promise<FetchTokoVoucherOperatorsOutput> {
  return fetchTokoVoucherOperatorsFlow(input);
}

const fetchTokoVoucherOperatorsFlow = ai.defineFlow(
  {
    name: 'fetchTokoVoucherOperatorsFlow',
    inputSchema: FetchTokoVoucherOperatorsInputSchema,
    outputSchema: FetchTokoVoucherOperatorsOutputSchema,
  },
  async ({ categoryId }) => {
    const adminSettings = await getAdminSettingsFromDB();
    const memberCode = adminSettings.tokovoucherMemberCode;
    const signature = adminSettings.tokovoucherSignature;

    if (!memberCode || !signature) {
      return { isSuccess: false, message: 'TokoVoucher Member Code or Signature not configured.' };
    }

    const apiUrl = `https://api.tokovoucher.net/member/produk/operator/list?member_code=${memberCode}&signature=${signature}&id=${categoryId}`;

    try {
      const response = await fetch(apiUrl);
      const responseData = await response.json();

      if (responseData.status && Number(responseData.status) === 1 && responseData.data) {
        const parsedData = z.array(TokoVoucherOperatorSchema).parse(responseData.data);
        return { isSuccess: true, data: parsedData };
      } else {
        return { isSuccess: false, message: responseData.error_msg || 'Failed to fetch operators.' };
      }
    } catch (error) {
      console.error('Error fetching TokoVoucher operators:', error);
      return { isSuccess: false, message: error instanceof Error ? error.message : 'Unknown error.' };
    }
  }
);
