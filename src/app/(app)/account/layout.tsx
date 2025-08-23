// src/app/(app)/account/layout.tsx
"use client";

import type { ReactNode } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from "@/components/ui/card";
import { UserCog, AlertTriangle } from "lucide-react";

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  if (!user) {
    return (
        <div className="text-center py-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-2xl font-bold">User Not Found</h2>
            <p className="mt-2 text-muted-foreground">Could not find user data. Please try logging in again.</p>
        </div>
    );
  }

  return (
     <div className="space-y-6">
        <div className="flex items-center gap-3">
            <UserCog className="h-8 w-8 text-primary" />
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-headline">Akun & Pengaturan</h1>
                <p className="text-muted-foreground">Kelola akun, keamanan, dan pengaturan aplikasi Anda.</p>
            </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            {children}
          </CardContent>
        </Card>
    </div>
  );
}
