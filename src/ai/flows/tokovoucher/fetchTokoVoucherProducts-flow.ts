
'use server';
/**
 * @fileOverview Fetches the final list of products for a given product type ID from TokoVoucher.
 * - fetchTokoVoucherProducts
 * - TokoVoucherProduct
 * - FetchTokoVoucherProductsInput
 * - FetchTokoVoucherProductsOutput
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

const FetchTokoVoucherProductsInputSchema = z.object({
  productTypeId: z.number().describe('The ID of the product type (id_jenis) to fetch products for.'),
});
export type FetchTokoVoucherProductsInput = z.infer<typeof FetchTokoVoucherProductsInputSchema>;

const TokoVoucherProductSchema = z.object({
  code: z.string(),
  nama_produk: z.string(),
  price: z.number(),
  status: z.number().describe('1 for active, 0 for inactive/gangguan'), // Assuming 1 is active
  keterangan: z.string().optional().nullable(),
  op_id: z.string().optional().nullable(), // operator id
  op_name: z.string().optional().nullable(), // operator name
  jenis_id: z.string().optional().nullable(), // jenis id
  jenis_name: z.string().optional().nullable(), // jenis name
  category_id: z.string().optional().nullable(),
  category_name: z.string().optional().nullable(),
  image: z.string().url().optional().nullable(),
});
export type TokoVoucherProduct = z.infer<typeof TokoVoucherProductSchema>;

const FetchTokoVoucherProductsOutputSchema = z.object({
    isSuccess: z.boolean(),
    data: z.array(TokoVoucherProductSchema).optional(),
    message: z.string().optional(),
});
export type FetchTokoVoucherProductsOutput = z.infer<typeof FetchTokoVoucherProductsOutputSchema>;

export async function fetchTokoVoucherProducts(input: FetchTokoVoucherProductsInput): Promise<FetchTokoVoucherProductsOutput> {
  return fetchTokoVoucherProductsFlow(input);
}

const fetchTokoVoucherProductsFlow = ai.defineFlow(
  {
    name: 'fetchTokoVoucherProductsFlow',
    inputSchema: FetchTokoVoucherProductsInputSchema,
    outputSchema: FetchTokoVoucherProductsOutputSchema,
  },
  async ({ productTypeId }) => {
    const adminSettings = await getAdminSettingsFromDB();
    const memberCode = adminSettings.tokovoucherMemberCode;
    const signature = adminSettings.tokovoucherSignature;

    if (!memberCode || !signature) {
      return { isSuccess: false, message: 'TokoVoucher Member Code or Signature not configured.' };
    }

    const apiUrl = `https://api.tokovoucher.net/member/produk/list?member_code=${memberCode}&signature=${signature}&id_jenis=${productTypeId}`;

    try {
      const response = await fetch(apiUrl);
      const responseData = await response.json();

      if (responseData.status && Number(responseData.status) === 1 && responseData.data) {
        const parsedData = z.array(TokoVoucherProductSchema).parse(responseData.data);
        return { isSuccess: true, data: parsedData };
      } else {
        return { isSuccess: false, message: responseData.error_msg || 'Failed to fetch products.' };
      }
    } catch (error) {
      console.error('Error fetching TokoVoucher products:', error);
      return { isSuccess: false, message: error instanceof Error ? error.message : 'Unknown error.' };
    }
  }
);
