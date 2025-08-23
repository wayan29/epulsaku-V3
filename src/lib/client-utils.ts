
// src/lib/client-utils.ts
"use client"; 

// Kunci untuk localStorage (sama seperti sebelumnya)
const LAST_REF_ID_DATE_KEY = "ePulsakuLastRefIdDate";
const LAST_REF_ID_COUNTER_KEY = "ePulsakuLastRefIdCounter";

export function generateRefId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');

  const dateTimePart = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const currentDateKey = `${year}${month}${day}`;

  let counter = 1;
  // Akses localStorage hanya jika di lingkungan browser
  if (typeof window !== "undefined") {
    const lastDate = localStorage.getItem(LAST_REF_ID_DATE_KEY);
    const lastCounterStr = localStorage.getItem(LAST_REF_ID_COUNTER_KEY);

    if (lastDate === currentDateKey && lastCounterStr) {
      counter = parseInt(lastCounterStr, 10) + 1;
    }
    localStorage.setItem(LAST_REF_ID_DATE_KEY, currentDateKey);
    localStorage.setItem(LAST_REF_ID_COUNTER_KEY, counter.toString());
  } else {
    // Fallback sederhana jika tidak di browser (seharusnya tidak terjadi jika hanya dipanggil dari klien)
    counter = Math.floor(Math.random() * 1000) + 1;
  }

  return `${dateTimePart}-${counter.toString().padStart(3, '0')}`;
}

// formatTelegramNotificationMessage and escapeTelegramReservedChars moved to notification-utils.ts
// TelegramNotificationDetails also moved as it's tied to formatTelegramNotificationMessage
