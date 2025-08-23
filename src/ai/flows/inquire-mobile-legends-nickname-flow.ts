
'use server';
/**
 * @fileOverview A Genkit flow for inquiring Mobile Legends nickname using a primary (Codashop) and secondary (GoPay) API.
 *
 * - inquireMobileLegendsNickname - A function that calls the Mobile Legends nickname inquiry flow.
 * - InquireMobileLegendsNicknameInput - The input type for the function.
 * - InquireMobileLegendsNicknameOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InquireMobileLegendsNicknameInputSchema = z.object({
  userId: z.string().min(5, "User ID must be at least 5 characters").describe('The Mobile Legends User ID.'),
  zoneId: z.string().min(1, "Zone ID is required").describe('The Mobile Legends Zone ID.'),
});
export type InquireMobileLegendsNicknameInput = z.infer<typeof InquireMobileLegendsNicknameInputSchema>;

const InquireMobileLegendsNicknameOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the nickname inquiry was successful.'),
  nickname: z.string().optional().describe('The Mobile Legends nickname if found.'),
  message: z.string().optional().describe('An optional message, e.g., error message or status message.'),
  rawResponse: z.any().optional().describe('The raw response data from the API for debugging.'),
});
export type InquireMobileLegendsNicknameOutput = z.infer<typeof InquireMobileLegendsNicknameOutputSchema>;

export async function inquireMobileLegendsNickname(input: InquireMobileLegendsNicknameInput): Promise<InquireMobileLegendsNicknameOutput> {
  return inquireMobileLegendsNicknameFlow(input);
}


// --- GoPay API Fallback Function ---
async function inquireViaGoPay(userId: string, zoneId: string): Promise<InquireMobileLegendsNicknameOutput> {
  console.log('Codashop did not return nickname, trying GoPay API fallback...');
  const goPayApiUrl = 'https://gopay.co.id/games/v1/order/user-account';
  const payload = {
    code: "MOBILE_LEGENDS",
    data: { userId, zoneId }
  };

  try {
    const response = await fetch(goPayApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    
    if (response.ok && responseData.message?.toLowerCase() === 'success' && responseData.data?.username) {
      return {
        isSuccess: true,
        nickname: responseData.data.username,
        message: 'Nickname found.',
        rawResponse: responseData,
      };
    } else {
      console.error('GoPay API Fallback Failed:', responseData);
      return {
        isSuccess: false,
        message: responseData.message || 'Unknown error.',
        rawResponse: responseData,
      };
    }
  } catch (error) {
    console.error('Error during GoPay API fallback request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during GoPay fallback.';
    return {
      isSuccess: false,
      message: `Service error: ${errorMessage}`,
    };
  }
}


const inquireMobileLegendsNicknameFlow = ai.defineFlow(
  {
    name: 'inquireMobileLegendsNicknameFlow',
    inputSchema: InquireMobileLegendsNicknameInputSchema,
    outputSchema: InquireMobileLegendsNicknameOutputSchema,
  },
  async (input) => {
    // --- Primary API: Codashop ---
    const codashopApiUrl = 'https://order-sg.codashop.com/initPayment.action';
    const datePart = new Date().toLocaleDateString('en-CA');
    const randomPart = Math.floor(Math.random() * 1000);
    const nonce = `${datePart.replace(/-/g, '/')}-${randomPart}`;

    const postData = {
      'voucherPricePoint.id': 1471,
      'voucherPricePoint.price': 84360.0,
      'voucherPricePoint.variablePrice': 0,
      'n': nonce,
      'email': '',
      'userVariablePrice': 0,
      'order.data.profile': 'eyJuYW1lIjoiICIsImRhdGVvZmJpcnRoIjoiIiwiaWRfbm8iOiIifQ==',
      'user.userId': input.userId,
      'user.zoneId': input.zoneId,
      'msisdn': '',
      'voucherTypeName': 'MOBILE_LEGENDS',
      'shopLang': 'id_ID',
      'voucherTypeId': 5,
      'gvtId': 19,
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
        console.error('Codashop API HTTP error response (ML Nickname):', responseData);
        // Fallback on HTTP error
        return await inquireViaGoPay(input.userId, input.zoneId);
      }

      if (responseData.RESULT_CODE === '10001' || responseData.resultCode === '10001') {
        return { isSuccess: false, message: 'Too many attempts. Please wait and try again.', rawResponse: responseData };
      }
      
      if (responseData.success && !responseData.errorMsg) {
        let extractedNickname: string | undefined = undefined;

        if (responseData.confirmationFields?.username) {
            extractedNickname = decodeURIComponent(responseData.confirmationFields.username as string);
        }
        
        if (!extractedNickname && responseData.result && typeof responseData.result === 'string') {
          try {
            const decodedResultString = decodeURIComponent(responseData.result);
            const resultData = JSON.parse(decodedResultString);
             if (resultData.username) { 
              extractedNickname = decodeURIComponent(resultData.username as string);
            } else if (resultData.roles && resultData.roles[0] && resultData.roles[0].role) {
              extractedNickname = decodeURIComponent(resultData.roles[0].role as string);
            }
          } catch (e) {
            console.warn("Could not parse nickname from 'result' field for ML:", e);
          }
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
          return await inquireViaGoPay(input.userId, input.zoneId);
        }
      } else {
        console.error('Codashop API returned an error (ML Nickname):', responseData);
        if (responseData.errorMsg) {
            return { isSuccess: false, message: responseData.errorMsg, rawResponse: responseData };
        }
        // Fallback if no specific error message is present
        return await inquireViaGoPay(input.userId, input.zoneId);
      }
    } catch (error) {
      console.error('Error during Mobile Legends nickname inquiry (Codashop):', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during nickname inquiry.';
      return { isSuccess: false, message: `Service error: ${errorMessage}` };
    }
  }
);
