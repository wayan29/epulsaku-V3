// src/lib/transaction-utils.ts
'use server';

import type { TransactionStatus, NewTransactionInput, TransactionCore } from "@/components/transactions/TransactionItem"; 
import { productIconsMapping } from "@/components/transactions/TransactionItem";
import { readDb, writeDb } from './mongodb';
import { revalidatePath } from 'next/cache';
import { fetchSingleCustomPriceFromDB } from '@/lib/db-price-settings-utils'; 
import { subMonths } from 'date-fns';
import type { ObjectId } from 'mongodb';

const TRANSACTIONS_DB = "transactions_log";

const RELEVANT_PULSA_CATEGORIES_UPPER = ["PULSA", "PAKET DATA"];
const RELEVANT_PLN_CATEGORIES_UPPER = ["PLN", "TOKEN LISTRIK", "TOKEN"];
const RELEVANT_GAME_CATEGORIES_UPPER = ["GAME", "TOPUP", "VOUCHER GAME", "DIAMOND", "UC"];
const RELEVANT_EMONEY_CATEGORIES_UPPER = ["E-MONEY", "E-WALLET", "SALDO DIGITAL", "DANA", "OVO", "GOPAY", "SHOPEEPAY", "MAXIM"];


export interface Transaction extends TransactionCore {
  iconName: string;
  categoryKey: string; 
  _id: string; // Ensure _id is always a string for client components
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

const makeTransactionSerializable = (tx: any): Transaction => {
  if (tx._id && typeof tx._id !== 'string') {
    tx._id = tx._id.toHexString();
  }
  return tx as Transaction;
};


export async function addTransactionToDB(newTransactionInput: NewTransactionInput, transactedByUsername: string): Promise<{ success: boolean, transactionId?: string, message?: string }> {
  try {
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

    const docToInsert: TransactionCore & { _id?: ObjectId } = {
      ...newTransactionInput,
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
    
    // Do not assign _id, let MongoDB handle it.
    await writeDb(TRANSACTIONS_DB, docToInsert, { mode: 'insertOne' });

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
    const transactionsFromDb = await readDb<any[]>(TRANSACTIONS_DB);
    const transactions = transactionsFromDb.map(makeTransactionSerializable);
    return transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error("Error fetching transactions from DB:", error);
    return [];
  }
}

export async function getTransactionByIdFromDB(transactionId: string): Promise<Transaction | null> {
  try {
    const transaction = await readDb<any>(TRANSACTIONS_DB, { query: { id: transactionId } });
    if (!transaction) return null;
    return makeTransactionSerializable(transaction);
  } catch (error) {
    console.error(`Error fetching transaction by ID ${transactionId} from DB:`, error);
    return null;
  }
}

export async function updateTransactionInDB(updatedTxData: Partial<TransactionCore> & { id: string }): Promise<{ success: boolean, message?: string }> {
  try {
    const existingTransaction = await getTransactionByIdFromDB(updatedTxData.id);

    if (!existingTransaction) {
      return { success: false, message: `Transaction with id ${updatedTxData.id} not found for update.` };
    }
    
    const updatePayload: { [key: string]: any } = { ...updatedTxData };
    delete updatePayload.id;

    if (existingTransaction.status === "Pending" && updatedTxData.status && (updatedTxData.status === "Sukses" || updatedTxData.status === "Gagal")) {
        const now = new Date();
        updatePayload.timestamp = now.toISOString();
        updatePayload.transactionYear = now.getFullYear();
        updatePayload.transactionMonth = now.getMonth() + 1;
        updatePayload.transactionDayOfMonth = now.getDate();
        updatePayload.transactionDayOfWeek = now.getDay();
        updatePayload.transactionHour = now.getHours();
    }
    
    if (updatedTxData.costPrice !== undefined && updatedTxData.costPrice > 0 && updatedTxData.costPrice !== existingTransaction.costPrice) {
        updatePayload.sellingPrice = await calculateSellingPrice(
            updatedTxData.costPrice,
            existingTransaction.buyerSkuCode,
            existingTransaction.provider
        );
    }
    
    if (updatedTxData.productCategoryFromProvider !== undefined || updatedTxData.productBrandFromProvider !== undefined) {
        const { categoryKey, iconName } = determineTransactionCategoryDetails(
            updatedTxData.productCategoryFromProvider || existingTransaction.productCategoryFromProvider,
            updatedTxData.productBrandFromProvider || existingTransaction.productBrandFromProvider,
            existingTransaction.provider
        );
        updatePayload.categoryKey = categoryKey;
        updatePayload.iconName = iconName;
    }
    
    await writeDb(TRANSACTIONS_DB, updatePayload, { mode: 'updateOne', query: { id: updatedTxData.id } });
    
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
    const result = await writeDb(TRANSACTIONS_DB, null, { mode: 'deleteOne', query: { id: transactionId } });
    if (result && result.deletedCount > 0) {
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
