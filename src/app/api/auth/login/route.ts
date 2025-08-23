// src/app/api/auth/login/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getUserByUsername, verifyUserPassword, recordLoginSuccess } from '@/lib/user-utils';
import { generateToken, JWT_SECRET, MAX_ATTEMPTS, LOCKOUT_PERIOD_MS, type User, AUTH_COOKIE_NAME } from '@/lib/auth-utils';
import { serialize } from 'cookie';
import { z } from 'zod';

const LoginSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().min(1, { message: "Password is required." }),
  rememberMe: z.boolean().optional(),
});

// --- Start of Rate Limiting Implementation ---
interface LoginAttempt {
  count: number;
  expiry: number; // Timestamp when the lockout expires
}
const loginAttempts = new Map<string, LoginAttempt>(); // Keyed by IP Address

function getClientIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.headers.get('x-real-ip') || req.ip || '127.0.0.1';
}

function handleFailedLoginAttempt(ip: string) {
    const now = Date.now();
    const existingAttempt = loginAttempts.get(ip);

    let newCount = 1;
    // If there's an existing attempt and it hasn't expired, increment the count
    if (existingAttempt && now < existingAttempt.expiry) {
        newCount = existingAttempt.count + 1;
    }
    
    // Set a new expiry time from the current moment of failure
    loginAttempts.set(ip, {
        count: newCount,
        expiry: now + LOCKOUT_PERIOD_MS
    });
}
// --- End of Rate Limiting Implementation ---


export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  
  try {
    // --- Rate Limiting Check ---
    const now = Date.now();
    const attempt = loginAttempts.get(ip);
    if (attempt && now < attempt.expiry && attempt.count >= MAX_ATTEMPTS) {
        const timeLeft = Math.ceil((attempt.expiry - now) / 1000);
        return NextResponse.json(
            { message: `Too many failed login attempts. Please try again in ${timeLeft} seconds.`, lockoutTime: timeLeft }, 
            { status: 429 }
        );
    } else if (attempt && now >= attempt.expiry) {
        // Clear expired attempts
        loginAttempts.delete(ip);
    }
    // --- End Rate Limiting Check ---
    
    const body = await req.json();
    const parseResult = LoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: parseResult.error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    
    const { username, password, rememberMe } = parseResult.data;
    const normalizedUsername = username.toLowerCase();

    if (!JWT_SECRET) {
      console.error("FATAL: JWT_SECRET environment variable is not set.");
      return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
    }

    const userFromDb = await getUserByUsername(username);
    if (!userFromDb || !userFromDb.hashedPassword) {
      handleFailedLoginAttempt(ip);
      return NextResponse.json({ message: 'Invalid username or password.' }, { status: 401 });
    }

    // Check if user is disabled
    if (userFromDb.isDisabled) {
        return NextResponse.json({ message: 'Your account has been disabled. Please contact an administrator.' }, { status: 403 }); // 403 Forbidden
    }

    const isPasswordValid = await verifyUserPassword(password, userFromDb.hashedPassword);
    if (!isPasswordValid) {
      handleFailedLoginAttempt(ip);
      return NextResponse.json({ message: 'Invalid username or password.' }, { status: 401 });
    }
    
    // On success, clear any previous failed attempts for this IP
    loginAttempts.delete(ip);
    
    // Record login activity using headers from the request object
    const headersList = req.headers;
    const userAgent = headersList.get('user-agent');
    await recordLoginSuccess(userFromDb, userAgent, ip);

    // Generate Token
    const userForToken: User = { id: userFromDb._id, username: userFromDb.username, role: userFromDb.role, permissions: userFromDb.permissions || [] };
    const token = generateToken(userForToken, rememberMe);
    const maxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 8; // 7 days or 8 hours

    // Determine secure context for the cookie
    const forwardedProto = headersList.get('x-forwarded-proto');
    const urlProto = req.nextUrl?.protocol?.replace(':', '') || '';
    const isSecure = process.env.NODE_ENV === 'production' || forwardedProto === 'https' || urlProto === 'https';

    // Serialize and set cookie in the response header
    const serializedCookie = serialize(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: maxAge,
    });
    
    const response = NextResponse.json({ 
      success: true, 
      message: "Login successful.",
      user: userForToken,
    });
    response.headers.set('Set-Cookie', serializedCookie);
    
    return response;

  } catch (error) {
    console.error('API Login Error:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
