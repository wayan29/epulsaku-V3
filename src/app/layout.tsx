import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Providers } from '@/components/core/providers';
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider

export const metadata: Metadata = {
  title: 'ePulsaku - Digital Product Transactions',
  description: 'Buy phone credit, electricity tokens, and game top-ups easily.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#4338ca" />
      </head>
      <body className="font-body antialiased">
        <Providers>
          <AuthProvider> {/* Wrap the entire app in AuthProvider */}
            {children}
            <Toaster />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
