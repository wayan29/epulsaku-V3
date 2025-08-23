// src/ai/flows/check-balances-and-notify-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow to check provider balances and send notifications.
 *
 * This flow checks the balances for both Digiflazz and TokoVoucher.
 * If any balance is below a predefined threshold (200,000), it sends a
 * notification to the configured Telegram chat IDs.
 *
 * - checkBalancesAndNotify - The main function to trigger the balance check.
 * - BalanceCheckResult - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { fetchDigiflazzBalance } from '@/ai/flows/fetch-digiflazz-balance-flow';
import { fetchTokoVoucherBalance } from '@/ai/flows/tokovoucher/fetchTokoVoucherBalance-flow';
import { trySendTelegramNotification, type TelegramNotificationDetails } from '@/lib/notification-utils';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';

const BALANCE_THRESHOLD = 200000;

const BalanceCheckResultSchema = z.object({
  status: z.string(),
  checkedProviders: z.array(z.string()),
  notificationsSent: z.number(),
  errors: z.array(z.string()),
});
export type BalanceCheckResult = z.infer<typeof BalanceCheckResultSchema>;

export async function checkBalancesAndNotify(): Promise<BalanceCheckResult> {
  return checkBalancesAndNotifyFlow();
}

const checkBalancesAndNotifyFlow = ai.defineFlow(
  {
    name: 'checkBalancesAndNotifyFlow',
    inputSchema: z.void(),
    outputSchema: BalanceCheckResultSchema,
  },
  async () => {
    const checkedProviders: string[] = [];
    const errors: string[] = [];
    let notificationsSent = 0;

    // Check if Telegram is configured first
    const adminSettings = await getAdminSettingsFromDB();
    if (!adminSettings.telegramBotToken || !adminSettings.telegramChatId) {
        const message = "Telegram notifications are not configured. Halting balance check.";
        console.warn(`[Balance Check] ${message}`);
        return {
            status: "Halted",
            checkedProviders,
            notificationsSent,
            errors: [message],
        };
    }

    // 1. Check Digiflazz Balance
    try {
      if (adminSettings.digiflazzUsername && adminSettings.digiflazzApiKey) {
        const digiflazzResult = await fetchDigiflazzBalance();
        checkedProviders.push('Digiflazz');

        if (digiflazzResult.balance < BALANCE_THRESHOLD) {
          const notificationDetails: TelegramNotificationDetails = {
            provider: 'System',
            productName: 'Low Balance Alert',
            status: 'Warning',
            failureReason: `Saldo Digiflazz Anda kritis: Rp ${digiflazzResult.balance.toLocaleString()}. Harap segera top up.`,
            transactedBy: 'System Monitor',
            timestamp: new Date(),
            refId: `BALANCE_ALERT_DIGI_${Date.now()}`,
            customerNoDisplay: 'Provider: Digiflazz',
          };
          await trySendTelegramNotification(notificationDetails);
          notificationsSent++;
        }
      } else {
        console.log("[Balance Check] Skipping Digiflazz: Not configured.");
      }
    } catch (error) {
      const errorMessage = `Failed to check Digiflazz balance: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[Balance Check] ${errorMessage}`);
      errors.push(errorMessage);
    }

    // 2. Check TokoVoucher Balance
    try {
      if (adminSettings.tokovoucherMemberCode && adminSettings.tokovoucherSignature) {
        const tokovoucherResult = await fetchTokoVoucherBalance();
        checkedProviders.push('TokoVoucher');

        if (tokovoucherResult.isSuccess && typeof tokovoucherResult.saldo === 'number' && tokovoucherResult.saldo < BALANCE_THRESHOLD) {
          const notificationDetails: TelegramNotificationDetails = {
            provider: 'System',
            productName: 'Low Balance Alert',
            status: 'Warning',
            failureReason: `Saldo TokoVoucher Anda kritis: Rp ${tokovoucherResult.saldo.toLocaleString()}. Harap segera top up.`,
            transactedBy: 'System Monitor',
            timestamp: new Date(),
            refId: `BALANCE_ALERT_TOKO_${Date.now()}`,
            customerNoDisplay: 'Provider: TokoVoucher',
          };
          await trySendTelegramNotification(notificationDetails);
          notificationsSent++;
        } else if (!tokovoucherResult.isSuccess) {
           throw new Error(tokovoucherResult.message || 'Failed to fetch balance from TokoVoucher.');
        }
      } else {
         console.log("[Balance Check] Skipping TokoVoucher: Not configured.");
      }
    } catch (error) {
      const errorMessage = `Failed to check TokoVoucher balance: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[Balance Check] ${errorMessage}`);
      errors.push(errorMessage);
    }

    return {
      status: errors.length > 0 ? 'Completed with errors' : 'Completed successfully',
      checkedProviders,
      notificationsSent,
      errors,
    };
  }
);
