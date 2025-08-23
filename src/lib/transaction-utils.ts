// src/lib/transaction-utils.ts
'use server';

import type { TransactionStatus, NewTransactionInput, TransactionCore } from "@/components/transactions/TransactionItem"; 
import { productIconsMapping } from "@/components/transactions/TransactionItem";
import { readDb, writeDb } from './mongodb'; // Now json-db helpers
import { revalidatePath } from 'next/cache';
import { fetchSingleCustomPriceFromDB } from '@/lib/db-price-settings-utils'; 
import crypto from 'crypto';
import { subMonths } from 'date-fns';

const TRANSACTIONS_DB = "transactions_log";

const RELEVANT_PULSA_CATEGORIES_UPPER = ["PULSA", "PAKET DATA"];
const RELEVANT_PLN_CATEGORIES_UPPER = ["PLN", "TOKEN LISTRIK", "TOKEN"];
const RELEVANT_GAME_CATEGORIES_UPPER = ["GAME", "TOPUP", "VOUCHER GAME", "DIAMOND", "UC"];
const RELEVANT_EMONEY_CATEGORIES_UPPER = ["E-MONEY", "E-WALLET", "SALDO DIGITAL", "DANA", "OVO", "GOPAY", "SHOPEEPAY", "MAXIM"];


export interface Transaction extends TransactionCore {
  iconName: string;
  categoryKey: string; 
  _id?: string; 
}

// Function to automatically delete transactions older than 3 months
async function deleteOldTransactions(): Promise<void> {
  try {
    const allTransactions = await readDb<Transaction[]>(TRANSACTIONS_DB);
    if (allTransactions.length === 0) return;

    const threeMonthsAgo = subMonths(new Date(), 3);
    
    const recentTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.timestamp);
      // Keep transaction if date is invalid (shouldn't happen) or if it's within the last 3 months
      return isNaN(txDate.getTime()) || txDate >= threeMonthsAgo;
    });

    // If the number of transactions has changed, write the new list back to the DB
    if (recentTransactions.length < allTransactions.length) {
      console.log(`[DB Pruning] Deleting ${allTransactions.length - recentTransactions.length} transactions older than 3 months.`);
      await writeDb(TRANSACTIONS_DB, recentTransactions);
    }
  } catch (error) {
    console.error("Error pruning old transactions from DB:", error);
    // We don't throw an error here to not disrupt the main flow (e.g., fetching transactions)
  }
}

function determineTransactionCategoryDetails(
  productCategory: string,
  productBrand: string,
  provider?: 'digiflazz' | 'tokovoucher' 
): { categoryKey: string; iconName: string } {
  const categoryUpper = productCategory.toUpperCase();
  const brandUpper = productBrand.toUpperCase();

  if (RELEVANT_PULSA_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat) || brandUpper.includes(cat))) {
    return { categoryKey: "Pulsa", iconName: "Pulsa" };
  }
  if (brandUpper.includes("PLN") || RELEVANT_PLN_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat))) {
    return { categoryKey: "Token Listrik", iconName: "Token Listrik" };
  }
  if (brandUpper.includes("FREE FIRE")) return { categoryKey: "FREE FIRE", iconName: "FREE FIRE" };
  if (brandUpper.includes("MOBILE LEGENDS")) return { categoryKey: "MOBILE LEGENDS", iconName: "MOBILE LEGENDS" };
  if (brandUpper.includes("GENSHIN IMPACT")) return { categoryKey: "GENSHIN IMPACT", iconName: "GENSHIN IMPACT" };
  if (brandUpper.includes("HONKAI STAR RAIL")) return { categoryKey: "HONKAI STAR RAIL", iconName: "HONKAI STAR RAIL" };
  
  if (RELEVANT_GAME_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat) || brandUpper.includes(cat))) {
    return { categoryKey: "Game Topup", iconName: "Game Topup" };
  }
  if (RELEVANT_EMONEY_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat) || brandUpper.includes(cat))) {
    return { categoryKey: "E-Money", iconName: "E-Money" };
  }
  
  const fallbackKey = productCategory || "Digital Service";
  const iconMatch = Object.keys(productIconsMapping).find(k => fallbackKey.toUpperCase().includes(k.toUpperCase()));
  
  if (iconMatch) {
    return { categoryKey: iconMatch, iconName: iconMatch };
  }

  return { 
    categoryKey: "Default", 
    iconName: "Default"
  };
}

async function calculateSellingPrice (costPrice: number, productCode: string, provider: 'digiflazz' | 'tokovoucher'): Promise<number> {
  const customPrice = await fetchSingleCustomPriceFromDB(productCode, provider); 
  if (customPrice && customPrice > 0) {
    return customPrice;
  }
  if (costPrice < 20000) {
    return costPrice + 1000;
  } else if (costPrice >= 20000 && costPrice <= 50000) {
    return costPrice + 1500;
  } else {
    return costPrice + 2000;
  }
};

export async function addTransactionToDB(newTransactionInput: NewTransactionInput, transactedByUsername: string): Promise<{ success: boolean, transactionId?: string, message?: string }> {
  try {
    const transactions = await readDb<Transaction[]>(TRANSACTIONS_DB);
    
    const { categoryKey, iconName } = determineTransactionCategoryDetails(
      newTransactionInput.productCategoryFromProvider,
      newTransactionInput.productBrandFromProvider,
      newTransactionInput.provider
    );
    
    const sellingPrice = await calculateSellingPrice(
        newTransactionInput.costPrice, 
        newTransactionInput.buyerSkuCode,
        newTransactionInput.provider
    );
    
    const transactionDate = new Date(newTransactionInput.timestamp);

    const docToInsert: Transaction = {
      ...newTransactionInput,
      _id: crypto.randomUUID(), // Internal ID for JSON file
      sellingPrice: sellingPrice,
      source: newTransactionInput.source || 'web', 
      categoryKey: categoryKey,
      iconName: iconName,
      providerTransactionId: newTransactionInput.providerTransactionId,
      transactionYear: transactionDate.getFullYear(),
      transactionMonth: transactionDate.getMonth() + 1,
      transactionDayOfMonth: transactionDate.getDate(),
      transactionDayOfWeek: transactionDate.getDay(),
      transactionHour: transactionDate.getHours(),
      transactedBy: transactedByUsername,
    };

    transactions.push(docToInsert);
    await writeDb(TRANSACTIONS_DB, transactions);

    revalidatePath('/transactions'); 
    revalidatePath('/profit-report'); 
    return { success: true, transactionId: newTransactionInput.id };
  } catch (error) {
    console.error("Error adding transaction to DB:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown DB error." };
  }
}

export async function getTransactionsFromDB(): Promise<Transaction[]> {
  try {
    // Prune old transactions before fetching. This is an asynchronous fire-and-forget.
    deleteOldTransactions();
    
    const transactions = await readDb<Transaction[]>(TRANSACTIONS_DB);
    // Sort by timestamp descending
    return transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error("Error fetching transactions from DB:", error);
    return [];
  }
}

export async function getTransactionByIdFromDB(transactionId: string): Promise<Transaction | null> {
  try {
    const transactions = await readDb<Transaction[]>(TRANSACTIONS_DB);
    return transactions.find(tx => tx.id === transactionId) || null;
  } catch (error) {
    console.error(`Error fetching transaction by ID ${transactionId} from DB:`, error);
    return null;
  }
}

export async function updateTransactionInDB(updatedTxData: Partial<TransactionCore> & { id: string }): Promise<{ success: boolean, message?: string }> {
  try {
    const transactions = await readDb<Transaction[]>(TRANSACTIONS_DB);
    const txIndex = transactions.findIndex(tx => tx.id === updatedTxData.id);

    if (txIndex === -1) {
      return { success: false, message: `Transaction with id ${updatedTxData.id} not found for update.` };
    }

    const existingTransaction = transactions[txIndex];
    
    // Create the updated transaction object
    const updatedTransaction = { ...existingTransaction, ...updatedTxData };
    
    // Logic for timestamp update on status change from Pending
    if (existingTransaction.status === "Pending" && updatedTxData.status && (updatedTxData.status === "Sukses" || updatedTxData.status === "Gagal")) {
        const now = new Date();
        updatedTransaction.timestamp = now.toISOString();
        updatedTransaction.transactionYear = now.getFullYear();
        updatedTransaction.transactionMonth = now.getMonth() + 1;
        updatedTransaction.transactionDayOfMonth = now.getDate();
        updatedTransaction.transactionDayOfWeek = now.getDay();
        updatedTransaction.transactionHour = now.getHours();
    }
    
    // Recalculate selling price if necessary
    if (updatedTxData.costPrice !== undefined && updatedTxData.costPrice > 0 && updatedTxData.costPrice !== existingTransaction.costPrice) {
        updatedTransaction.sellingPrice = await calculateSellingPrice(
            updatedTransaction.costPrice,
            updatedTransaction.buyerSkuCode,
            updatedTransaction.provider
        );
    }
    
    // Update category/icon if relevant fields changed
    if (updatedTxData.productCategoryFromProvider !== undefined || updatedTxData.productBrandFromProvider !== undefined) {
        const { categoryKey, iconName } = determineTransactionCategoryDetails(
            updatedTransaction.productCategoryFromProvider,
            updatedTransaction.productBrandFromProvider,
            updatedTransaction.provider
        );
        updatedTransaction.categoryKey = categoryKey;
        updatedTransaction.iconName = iconName;
    }
    
    // Replace the old transaction with the updated one
    transactions[txIndex] = updatedTransaction;

    await writeDb(TRANSACTIONS_DB, transactions);
    
    revalidatePath('/transactions'); 
    revalidatePath('/profit-report');
    return { success: true };
  } catch (error) {
    console.error(`Error updating transaction ${updatedTxData.id} in DB:`, error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown DB error during update." };
  }
}

export async function deleteTransactionFromDB(transactionId: string): Promise<{ success: boolean, message?: string }> {
  try {
    const transactions = await readDb<Transaction[]>(TRANSACTIONS_DB);
    const initialLength = transactions.length;
    const updatedTransactions = transactions.filter(tx => tx.id !== transactionId);

    if (updatedTransactions.length < initialLength) {
        await writeDb(TRANSACTIONS_DB, updatedTransactions);
        revalidatePath('/transactions'); 
        revalidatePath('/profit-report');
        return { success: true };
    } else {
        return { success: false, message: `Transaction with id ${transactionId} not found for deletion.` };
    }
  } catch (error) {
    console.error(`Error deleting transaction ${transactionId} from DB:`, error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown DB error during deletion." };
  }
}
