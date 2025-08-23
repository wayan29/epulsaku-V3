// src/lib/chat-memory.ts
'use server';

import { readDb, writeDb } from './mongodb';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatSessionsDB {
  [userId: string]: ChatSession;
}

const MEMORY_WINDOW = 10; // Number of previous messages to remember

export async function saveMessage(userId: string, message: ChatMessage): Promise<void> {
  const sessions = await readDb<ChatSessionsDB>('chat_sessions');
  
  if (!sessions[userId]) {
    // Create new session
    sessions[userId] = {
      userId,
      messages: [message],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } else {
    // Update existing session
    sessions[userId].messages.push(message);
    sessions[userId].updatedAt = new Date();
  }

  await writeDb('chat_sessions', sessions);
}

export async function getRecentMessages(userId: string): Promise<ChatMessage[]> {
  const sessions = await readDb<ChatSessionsDB>('chat_sessions');
  const session = sessions[userId];
  
  if (!session) return [];
  
  // Return last N messages to maintain context window
  return session.messages.slice(-MEMORY_WINDOW);
}

export async function formatChatHistory(messages: ChatMessage[]): Promise<string> {
  const formattedMessages = messages.map(msg => {
    switch (msg.role) {
      case 'system':
        return `System: ${msg.content}`;
      case 'user':
        return `User: ${msg.content}`;
      case 'assistant':
        return `AI: ${msg.content}`;
      default:
        return '';
    }
  });
  
  return formattedMessages.join('\n\n');
}
