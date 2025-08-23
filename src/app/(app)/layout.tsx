// src/app/(app)/layout.tsx
"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import React, { useEffect } from 'react';
import Header from '@/components/core/Header';
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // AuthProvider will now handle the initial loading state,
  // but we still show a loader here while the check is happening after initial load.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  // Only render the layout if authenticated.
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="py-6 text-center text-sm text-muted-foreground border-t">
          © {new Date().getFullYear()} ePulsaku. All rights reserved.
        </footer>
      </div>
    );
  }

  // Return null or a loader while redirecting
  return null;
}