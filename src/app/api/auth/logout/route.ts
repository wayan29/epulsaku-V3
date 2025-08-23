// src/app/api/auth/logout/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-utils';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  // Use request headers to determine if the context is secure
  const headersList = req.headers;
  const forwardedProto = headersList.get('x-forwarded-proto');
  const urlProto = req.nextUrl?.protocol?.replace(':', '') || '';
  const isSecure = process.env.NODE_ENV === 'production' || forwardedProto === 'https' || urlProto === 'https';

  // Create a cookie with the same name but with an expiration date in the past
  // and maxAge of -1 to instruct the browser to delete it.
  const serializedCookie = serialize(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: -1,
  });

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.headers.set('Set-Cookie', serializedCookie);
  
  return response;
}
