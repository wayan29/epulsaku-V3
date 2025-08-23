
'use server';
/**
 * @fileOverview A Genkit flow for inquiring Free Fire nickname using a primary (Codashop) and secondary (GoPay) API.
 *
 * - inquireFreeFireNickname - A function that calls the Free Fire nickname inquiry flow.
 * - InquireFreeFireNicknameInput - The input type for the function.
 * - InquireFreeFireNicknameOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InquireFreeFireNicknameInputSchema = z.object({
  userId: z.string().min(5, "User ID must be at least 5 characters").describe('The Free Fire User ID.'),
});
export type InquireFreeFireNicknameInput = z.infer<typeof InquireFreeFireNicknameInputSchema>;

const InquireFreeFireNicknameOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the nickname inquiry was successful.'),
  nickname: z.string().optional().describe('The Free Fire nickname if found.'),
  message: z.string().optional().describe('An optional message, e.g., error message or status message.'),
  rawResponse: z.any().optional().describe('The raw response data from the API for debugging.'),
});
export type InquireFreeFireNicknameOutput = z.infer<typeof InquireFreeFireNicknameOutputSchema>;

export async function inquireFreeFireNickname(input: InquireFreeFireNicknameInput): Promise<InquireFreeFireNicknameOutput> {
  return inquireFreeFireNicknameFlow(input);
}

// --- GoPay API Fallback Function for Free Fire ---
async function inquireViaGoPay(userId: string): Promise<InquireFreeFireNicknameOutput> {
  console.log('Codashop did not return nickname, trying GoPay API fallback for Free Fire...');
  const goPayApiUrl = `https://gopay.co.id/games/v1/order/prepare/FREEFIRE?userId=${encodeURIComponent(userId)}&zoneId=`;

  try {
    const response = await fetch(goPayApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      },
    });

    const responseData = await response.json();
    
    // As per sample, success response is {"message":"Success","data":"<username>"}
    if (response.ok && responseData.message?.toLowerCase() === 'success' && typeof responseData.data === 'string') {
      return {
        isSuccess: true,
        nickname: responseData.data,
        message: 'Nickname found.',
        rawResponse: responseData,
      };
    } else {
      console.error('GoPay API Fallback Failed (FF):', responseData);
      return {
        isSuccess: false,
        message: responseData.message || 'Invalid User ID or unknown error.',
        rawResponse: responseData,
      };
    }
  } catch (error) {
    console.error('Error during GoPay API fallback request (FF):', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during GoPay fallback.';
    return {
      isSuccess: false,
      message: `Service error: ${errorMessage}`,
    };
  }
}


const inquireFreeFireNicknameFlow = ai.defineFlow(
  {
    name: 'inquireFreeFireNicknameFlow',
    inputSchema: InquireFreeFireNicknameInputSchema,
    outputSchema: InquireFreeFireNicknameOutputSchema,
  },
  async (input) => {
    // --- Primary API: Codashop ---
    const codashopApiUrl = 'https://order-sg.codashop.com/initPayment.action';
    const datePart = new Date().toLocaleDateString('en-CA');
    const randomPart = Math.floor(Math.random() * 1000);
    const nonce = `${datePart.replace(/-/g, '/')}-${randomPart}`;

    const postData = {
      'voucherPricePoint.id': 8120,
      'voucherPricePoint.price': 50000.0,
      'voucherPricePoint.variablePrice': 0,
      'n': nonce,
      'email': '',
      'userVariablePrice': 0,
      'order.data.profile': 'eyJuYW1lIjoiICIsImRhdGVvZmJpcnRoIjoiIiwiaWRfbm8iOiIifQ==',
      'user.userId': input.userId,
      'user.zoneId': '', // Typically empty for Free Fire on Codashop
      'msisdn': '',
      'voucherTypeName': 'FREEFIRE',
      'shopLang': 'id_ID',
      'voucherTypeId': 17,
      'gvtId': 33,
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
        console.error('Codashop API HTTP error response (FF Nickname):', responseData);
        // Fallback on HTTP error
        return await inquireViaGoPay(input.userId);
      }

      if (responseData.RESULT_CODE === '10001' || responseData.resultCode === '10001') {
        return { isSuccess: false, message: 'Too many attempts. Please wait and try again.', rawResponse: responseData };
      }
      
      if (responseData.success && !responseData.errorMsg) {
        let extractedNickname: string | undefined = undefined;

        if (responseData.result && typeof responseData.result === 'string') {
          try {
            const decodedResultString = decodeURIComponent(responseData.result);
            const resultData = JSON.parse(decodedResultString);
            if (resultData.roles && resultData.roles[0] && resultData.roles[0].role) {
              extractedNickname = decodeURIComponent(resultData.roles[0].role as string);
            } else if (resultData.username) { 
              extractedNickname = decodeURIComponent(resultData.username as string);
            }
          } catch (e) {
            console.warn("Could not parse nickname from 'result' field:", e);
          }
        }

        if (!extractedNickname && responseData.confirmationFields?.roles?.[0]?.role) {
          extractedNickname = decodeURIComponent(responseData.confirmationFields.roles[0].role as string);
        }

        if (!extractedNickname && responseData.confirmationFields?.username) {
          extractedNickname = decodeURIComponent(responseData.confirmationFields.username as string);
        }

        if (extractedNickname) {
          return {
            isSuccess: true,
            nickname: extractedNickname,
            message: 'Nickname inquiry successful.',
            rawResponse: responseData,
          };
        } else {
          // If Codashop call was successful but nickname is empty, try the fallback API.
          return await inquireViaGoPay(input.userId);
        }
      } else {
        console.error('Codashop API returned an error (FF Nickname):', responseData);
        if (responseData.errorMsg) {
            return { isSuccess: false, message: responseData.errorMsg, rawResponse: responseData };
        }
        // Fallback to GoPay even if Codashop fails with a business error, as it might be a temporary Codashop issue.
        return await inquireViaGoPay(input.userId);
      }
    } catch (error) {
      console.error('Error during Free Fire nickname inquiry (Codashop):', error);
      // If Codashop fails due to a network or client error, still try GoPay
      console.log('Trying GoPay fallback due to Codashop client-side error.');
      return await inquireViaGoPay(input.userId);
    }
  }
);
