// src/ai/flows/chat-flow.ts
'use server';
/**
 * @fileOverview A stateless Genkit flow for a simple chat interaction.
 * This flow does not retain any memory of past conversations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getRecentMessages, saveMessage, formatChatHistory, type ChatMessage } from '@/lib/chat-memory';
import { checkRateLimit } from '@/lib/rate-limiter';
import { validateMessage, sanitizeInput } from '@/lib/sanitize';

// ======== Chat Flow Schema ========
const ChatInputSchema = z.object({
  userId: z.string().default('demo-user').describe("A unique identifier for the user."),
  message: z.string().describe('The user\'s message to the AI.'),
  model: z.string().optional().describe('The AI model to use for the response.'),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const ChatOutputSchema = z.object({
  response: z.string().describe('The AI\'s response.'),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// ======== Main Chat Flow ========
export async function chatWithGemini(input: ChatInput): Promise<ChatOutput> {
  return chatFlow(input);
}

const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async ({ userId, message, model }) => {
    // Check rate limit
    const canProceed = await checkRateLimit(userId, 'chat');
    if (!canProceed) {
      throw new Error('Rate limit exceeded. Please wait a moment before sending more messages.');
    }

    // Validate and sanitize input
    const { isValid, error } = validateMessage(message);
    if (!isValid) {
      throw new Error(error || 'Invalid message');
    }
    const sanitizedMessage = sanitizeInput(message);
    
    const systemInstruction = `Anda adalah asisten AI yang ramah dan membantu bernama ePulsaku AI. Tujuan Anda adalah membantu pengguna secara akurat dan ringkas.
    Anda harus:
    1. Tidak memberikan informasi sensitif atau rahasia
    2. Menolak permintaan yang berbahaya atau tidak etis
    3. Memberikan informasi yang akurat dan terverifikasi
    4. Bersikap profesional dan sopan`;
    
    // Get recent chat history
    const recentMessages = await getRecentMessages(userId);
    
    // Add current message to history
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    // Format the prompt with system instruction and chat history
    const historyText = await formatChatHistory(recentMessages);
    const prompt = `${systemInstruction}\n\n${historyText}\nUser: ${message}\nAI:`;

    const llmResponse = await ai.generate({
        model: model || 'googleai/gemini-2.5-flash',
        prompt: prompt,
    });

    const answer = llmResponse.text;
    
    // Save both the user message and AI response
    await saveMessage(userId, userMessage);
    await saveMessage(userId, {
      role: 'assistant',
      content: answer,
      timestamp: new Date()
    });

    return { response: answer };
  }
);
