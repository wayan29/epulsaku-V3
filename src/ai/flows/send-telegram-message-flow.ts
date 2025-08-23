// src/ai/flows/send-telegram-message-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow for sending a message to a Telegram chat.
 *
 * - sendTelegramMessage - Sends a message using the Telegram Bot API.
 * - SendTelegramMessageInput - Input type for the flow.
 * - SendTelegramMessageOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SendTelegramMessageInputSchema = z.object({
  botToken: z.string().describe('The Telegram Bot Token.'),
  chatId: z.string().describe('The Telegram Chat ID to send the message to.'),
  message: z.string().describe('The message content to send (MarkdownV2 formatted).'),
});
export type SendTelegramMessageInput = z.infer<typeof SendTelegramMessageInputSchema>;

const SendTelegramMessageOutputSchema = z.object({
  success: z.boolean().describe('Whether the message was sent successfully.'),
  message: z.string().optional().describe('Response message from Telegram or error message.'),
  telegramResponse: z.any().optional().describe('Full response from Telegram API for debugging.'),
});
export type SendTelegramMessageOutput = z.infer<typeof SendTelegramMessageOutputSchema>;

export async function sendTelegramMessage(input: SendTelegramMessageInput): Promise<SendTelegramMessageOutput> {
  return sendTelegramMessageFlow(input);
}

const sendTelegramMessageFlow = ai.defineFlow(
  {
    name: 'sendTelegramMessageFlow',
    inputSchema: SendTelegramMessageInputSchema,
    outputSchema: SendTelegramMessageOutputSchema,
  },
  async ({ botToken, chatId, message }) => {
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const requestBody = {
      chat_id: chatId,
      text: message,
      parse_mode: 'MarkdownV2', 
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

      if (responseData.ok) {
        return { success: true, message: 'Message sent successfully.', telegramResponse: responseData };
      } else {
        console.error('Telegram API error:', responseData);
        return {
          success: false,
          message: `Telegram API error: ${responseData.description || response.statusText}`,
          telegramResponse: responseData,
        };
      }
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Failed to send message: ${errorMessage}` };
    }
  }
);
