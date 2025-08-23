// src/app/api/auth/login/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getUserByUsername, verifyUserPassword, recordLoginSuccess } from '@/lib/user-utils';
import { generateToken, JWT_SECRET, MAX_ATTEMPTS, LOCKOUT_PERIOD_MS, type User } from '@/lib/auth-utils';
import { headers } from 'next/headers';

// --- Start of Rate Limiting Implementation ---
interface LoginAttempt {
  count: number;
  expiry: number; // Timestamp when the lockout expires
}
const loginAttempts = new Map<string, LoginAttempt>();

function handleFailedLoginAttempt(username: string) {
    const now = Date.now();
    const existingAttempt = loginAttempts.get(username);

    let newCount = 1;
    if (existingAttempt && now < existingAttempt.expiry) {
        newCount = existingAttempt.count + 1;
    }
    
    loginAttempts.set(username, {
        count: newCount,
        expiry: now + LOCKOUT_PERIOD_MS
    });
}
// --- End of Rate Limiting Implementation ---


export async function POST(req: NextRequest) {
  try {
    const { username, password, rememberMe } = await req.json();
    const normalizedUsername = username.toLowerCase();

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required.' }, { status: 400 });
    }
    
    // --- Rate Limiting Check ---
    const now = Date.now();
    const attempt = loginAttempts.get(normalizedUsername);
    if (attempt && now < attempt.expiry && attempt.count >= MAX_ATTEMPTS) {
        const timeLeft = Math.ceil((attempt.expiry - now) / 1000);
        return NextResponse.json({ message: `Too many failed login attempts. Please try again in ${timeLeft} seconds.` }, { status: 429 });
    } else if (attempt && now >= attempt.expiry) {
        loginAttempts.delete(normalizedUsername);
    }
    // --- End Rate Limiting Check ---

    if (!JWT_SECRET) {
      console.error("FATAL: JWT_SECRET environment variable is not set.");
      return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
    }

    const userFromDb = await getUserByUsername(username);
    if (!userFromDb || !userFromDb.hashedPassword) {
      handleFailedLoginAttempt(normalizedUsername);
      return NextResponse.json({ message: 'Invalid username or password.' }, { status: 401 });
    }

    // Check if user is disabled
    if (userFromDb.isDisabled) {
        return NextResponse.json({ message: 'Your account has been disabled. Please contact an administrator.' }, { status: 403 }); // 403 Forbidden
    }

    const isPasswordValid = await verifyUserPassword(password, userFromDb.hashedPassword);
    if (!isPasswordValid) {
      handleFailedLoginAttempt(normalizedUsername);
      return NextResponse.json({ message: 'Invalid username or password.' }, { status: 401 });
    }
    
    // On success, clear any previous failed attempts
    loginAttempts.delete(normalizedUsername);
    
    // Record login activity
    const headersList = headers();
    const userAgent = headersList.get('user-agent');
    const ipAddress = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
    await recordLoginSuccess(userFromDb, userAgent, ipAddress);

    // Generate Token and send it back to the client
    const userForToken: User = { id: userFromDb._id, username: userFromDb.username, role: userFromDb.role, permissions: userFromDb.permissions || [] };
    const token = generateToken(userForToken, rememberMe);
    
    return NextResponse.json({ 
      success: true, 
      message: "Login successful.",
      user: userForToken,
      token: token
    });

  } catch (error) {
    console.error('API Login Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}