// src/lib/rate-limiter.ts
'use server';

import { readDb, writeDb } from './mongodb';

interface RateLimit {
  count: number;
  timestamp: number;
}

interface RateLimitDB {
  [key: string]: RateLimit;
}

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 20; // maximum requests per minute

export async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const limits = await readDb<RateLimitDB>('rate_limits');
  const now = Date.now();
  const key = `${userId}:${action}`;
  
  // Clean up old entries
  Object.keys(limits).forEach(k => {
    if (now - limits[k].timestamp > WINDOW_MS) {
      delete limits[k];
    }
  });
  
  if (!limits[key]) {
    limits[key] = {
      count: 1,
      timestamp: now
    };
    await writeDb('rate_limits', limits);
    return true;
  }
  
  const limit = limits[key];
  if (now - limit.timestamp > WINDOW_MS) {
    limits[key] = {
      count: 1,
      timestamp: now
    };
    await writeDb('rate_limits', limits);
    return true;
  }
  
  if (limit.count >= MAX_REQUESTS) {
    return false;
  }
  
  limit.count++;
  await writeDb('rate_limits', limits);
  return true;
}
