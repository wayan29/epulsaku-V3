// src/lib/json-db.ts
import path from 'path';
import fs from 'fs/promises';

// Tentukan path ke folder data di root direktori src
const dataDir = path.join(process.cwd(), 'src', 'data');

// Fungsi untuk memastikan folder data ada
async function ensureDataDirExists() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Helper function to return a default value for a given DB name
function getDefaultDbValue<T>(dbName: string): T {
    // This is a simple heuristic. 'users', 'transactions_log', 'login_activity' are arrays.
    if (dbName.endsWith('s') || dbName.includes('log') || dbName.includes('activity')) {
        return [] as T;
    }
    return {} as T;
}


// Fungsi untuk membaca data dari file JSON
export async function readDb<T>(dbName: string): Promise<T> {
  await ensureDataDirExists();
  const filePath = path.join(dataDir, `${dbName}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    // If the file is empty, JSON.parse will fail. Handle this case.
    if (data.trim() === '') {
        return getDefaultDbValue<T>(dbName);
    }
    return JSON.parse(data) as T;
  } catch (error) {
    // Jika file tidak ada, kembalikan state default (array kosong atau objek kosong)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return getDefaultDbValue<T>(dbName);
    }
    console.error(`Error reading database file ${dbName}.json:`, error);
    throw error;
  }
}

// Fungsi untuk menulis data ke file JSON
export async function writeDb<T>(dbName: string, data: T): Promise<void> {
  await ensureDataDirExists();
  const filePath = path.join(dataDir, `${dbName}.json`);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing to database file ${dbName}.json:`, error);
    throw error;
  }
}
