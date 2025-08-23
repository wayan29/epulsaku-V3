
'use server';
/**
 * @fileOverview A Genkit flow for fetching product categories from TokoVoucher.
 *
 * - fetchTokoVoucherCategories - Fetches product categories.
 * - TokoVoucherCategory - The type for a single category.
 * - FetchTokoVoucherCategoriesOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

const TokoVoucherCategorySchema = z.object({
  id: z.number(),
  nama: z.string(),
  image: z.string().url().optional().nullable(),
});
export type TokoVoucherCategory = z.infer<typeof TokoVoucherCategorySchema>;

const FetchTokoVoucherCategoriesOutputSchema = z.object({
    isSuccess: z.boolean(),
    data: z.array(TokoVoucherCategorySchema).optional(),
    message: z.string().optional(),
});
export type FetchTokoVoucherCategoriesOutput = z.infer<typeof FetchTokoVoucherCategoriesOutputSchema>;

export async function fetchTokoVoucherCategories(): Promise<FetchTokoVoucherCategoriesOutput> {
  return fetchTokoVoucherCategoriesFlow();
}

const fetchTokoVoucherCategoriesFlow = ai.defineFlow(
  {
    name: 'fetchTokoVoucherCategoriesFlow',
    inputSchema: z.void(),
    outputSchema: FetchTokoVoucherCategoriesOutputSchema,
  },
  async () => {
    const adminSettings = await getAdminSettingsFromDB();
    const memberCode = adminSettings.tokovoucherMemberCode;
    const signature = adminSettings.tokovoucherSignature;

    if (!memberCode || !signature) {
      return { isSuccess: false, message: 'TokoVoucher Member Code or Signature not configured.' };
    }

    const apiUrl = `https://api.tokovoucher.net/member/produk/category/list?member_code=${memberCode}&signature=${signature}`;

    try {
      const response = await fetch(apiUrl);
      const responseData = await response.json();

      if (responseData.status && Number(responseData.status) === 1 && responseData.data) {
        // Filter out unique categories by name as the PHP script does
        const uniqueCategoriesMap = new Map<string, TokoVoucherCategory>();
        responseData.data.forEach((item: any) => {
            if (!uniqueCategoriesMap.has(item.nama)) {
                try {
                    uniqueCategoriesMap.set(item.nama, TokoVoucherCategorySchema.parse(item));
                } catch (parseError) {
                    console.warn(`Skipping category due to parse error: ${item.nama}`, parseError);
                }
            }
        });
        return { isSuccess: true, data: Array.from(uniqueCategoriesMap.values()) };
      } else {
        return { isSuccess: false, message: responseData.error_msg || 'Failed to fetch categories.' };
      }
    } catch (error) {
      console.error('Error fetching TokoVoucher categories:', error);
      return { isSuccess: false, message: error instanceof Error ? error.message : 'Unknown error.' };
    }
  }
);
