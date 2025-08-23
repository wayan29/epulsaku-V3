// src/lib/notification-utils.ts
'use server';

import { getAdminSettingsFromDB } from './admin-settings-utils';
import { sendTelegramMessage } from '@/ai/flows/send-telegram-message-flow';
import { getUserByUsername, type StoredUser } from './user-utils';

export interface TelegramNotificationDetails {
  refId: string;
  productName: string;
  customerNoDisplay: string;
  status: string;
  provider: 'Digiflazz' | 'TokoVoucher' | 'System' | string;
  costPrice?: number;
  sellingPrice?: number;
  profit?: number;
  sn?: string | null;
  failureReason?: string | null;
  timestamp: Date;
  additionalInfo?: string;
  trxId?: string;
  transactedBy?: string; // Username of who made the transaction
}

// This is a local helper function, not exported.
function escapeTelegramReservedChars(text: string | number | null | undefined): string {
  if (text === null || typeof text === 'undefined') return '';
  const str = String(text);
  // Escape all reserved characters for MarkdownV2
  // Reserved characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return str.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// This function now handles both transaction and security alert notifications
function formatTelegramNotificationMessage(details: TelegramNotificationDetails): string {
  const time = escapeTelegramReservedChars(new Date(details.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
  
  // --- Security Alert Format ---
  if (details.provider === 'System' || details.productName === 'Account Security Alert') {
     let alertMessage = `*🚨 Peringatan Keamanan Akun ePulsaku 🚨*\n\n`;
     alertMessage += `👤 *Pengguna:* ${escapeTelegramReservedChars(details.transactedBy)}\n`;
     alertMessage += `🔵 *Status:* *${escapeTelegramReservedChars(details.status)}*\n`;
     if(details.failureReason) {
       alertMessage += `📝 *Alasan:* ${escapeTelegramReservedChars(details.failureReason)}\n`;
     }
     alertMessage += `\n🕒 _${time}_`;
     return alertMessage;
  }
  
  // --- Transaction Notification Format ---
  let statusIcon: string;
  let statusText: string;
  switch (details.status.toLowerCase()) {
    case 'sukses':
      statusIcon = '✅';
      statusText = '*TRANSAKSI SUKSES*';
      break;
    case 'gagal':
      statusIcon = '❌';
      statusText = '*TRANSAKSI GAGAL*';
      break;
    case 'pending':
      statusIcon = '⏳';
      statusText = '*TRANSAKSI PENDING*';
      break;
    default:
      statusIcon = '🔔';
      statusText = `*${escapeTelegramReservedChars(details.status)}*`;
  }
  
  let header = `${statusIcon} ${statusText} ${details.additionalInfo ? `\\- _${escapeTelegramReservedChars(details.additionalInfo)}_` : ''}\n\n`;

  let message = header;
  
  // Section: Transaction Details
  message += `*Detail Transaksi*\n`;
  message += `• 🆔 *Ref ID:* \`${escapeTelegramReservedChars(details.refId)}\`\n`;
  if (details.trxId) {
    message += `• 🔢 *Trx ID Provider:* \`${escapeTelegramReservedChars(details.trxId)}\`\n`;
  }
  message += `• 📦 *Produk:* ${escapeTelegramReservedChars(details.productName)}\n`;
  message += `• 🎯 *Tujuan:* ${escapeTelegramReservedChars(details.customerNoDisplay)}\n`;
  message += `• 🏢 *Provider:* ${escapeTelegramReservedChars(details.provider)}\n`;
  if (details.transactedBy) {
    message += `• 👤 *Oleh:* ${escapeTelegramReservedChars(details.transactedBy)}\n`;
  }
  message += `\n`;

  // Section: Financial Details (only for success)
  if (details.status.toLowerCase() === 'sukses') {
    message += `*Rincian Keuangan*\n`;
    if (typeof details.sellingPrice === 'number') {
      message += `• 📈 *Harga Jual:* Rp ${escapeTelegramReservedChars(details.sellingPrice.toLocaleString('id-ID'))}\n`;
    }
    if (typeof details.costPrice === 'number') {
      message += `• 📉 *Harga Modal:* Rp ${escapeTelegramReservedChars(details.costPrice.toLocaleString('id-ID'))}\n`;
    }
    if (typeof details.profit === 'number' && details.profit >= 0) {
      message += `• 💰 *Profit:* *Rp ${escapeTelegramReservedChars(details.profit.toLocaleString('id-ID'))}*\n`;
    }
    message += `\n`;
  }
  
  // Section: Status Details
  if (details.status.toLowerCase() === 'sukses' && details.sn) {
    message += `*Token/SN diterima:*\n`;
    message += `\`\`\`\n${escapeTelegramReservedChars(details.sn)}\n\`\`\`\n`;
  } else if (details.status.toLowerCase().includes('gagal') && details.failureReason) {
    message += `*📝 Alasan Gagal:*\n`;
    message += `${escapeTelegramReservedChars(details.failureReason)}\n\n`;
  }

  // Footer
  message += `_ePulsaku \\| ${time}_`;
  
  return message;
}

export async function trySendTelegramNotification(details: TelegramNotificationDetails) {
  try {
    const adminSettings = await getAdminSettingsFromDB();
    const botToken = adminSettings.telegramBotToken;
    const globalChatIdsString = adminSettings.telegramChatId;

    if (!botToken) {
      // console.warn('Telegram Bot Token not configured. Skipping all notifications for Ref ID:', details.refId);
      return;
    }

    const messageContent = formatTelegramNotificationMessage(details);
    const chatIdsToSendTo = new Set<string>();

    // 1. Add global admin chat IDs
    if (globalChatIdsString) {
      globalChatIdsString.split(',').map(id => id.trim()).filter(id => id).forEach(id => chatIdsToSendTo.add(id));
    }

    // 2. Add user-specific chat ID if available (only for transaction notifications, not for security alerts to admin)
    if (details.provider !== 'System' && details.transactedBy) {
      const user = await getUserByUsername(details.transactedBy);
      if (user && user.telegramChatId) {
        chatIdsToSendTo.add(user.telegramChatId);
      }
    }

    if (chatIdsToSendTo.size === 0) {
      // console.warn('No Telegram Chat IDs configured (neither global nor for the user). Skipping notification for Ref ID:', details.refId);
      return;
    }

    // 3. Send notifications
    for (const chatId of chatIdsToSendTo) {
      const result = await sendTelegramMessage({ botToken, chatId, message: messageContent });
      if (result.success) {
        console.log(`Telegram notification sent to Chat ID ${chatId} for event regarding user: ${details.transactedBy || details.refId}`);
      } else {
        console.warn(`Failed to send Telegram notification to Chat ID ${chatId} for event regarding user ${details.transactedBy || details.refId}: ${result.message}`);
      }
    }
  } catch (error) {
    console.error('Error in trySendTelegramNotification for event:', details, error);
  }
}
