// src/app/(app)/account/change-password/page.tsx
"use client";
import ChangePasswordForm from "@/components/account/ChangePasswordForm";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { redirect } from 'next/navigation';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  if (!user) {
    // This case should ideally be handled by the layout, but as a safeguard:
    redirect('/login');
  }

  return (
    <>
      <div className="p-0 mb-6 max-w-xl">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h2 className="text-xl font-semibold font-headline">Change Password</h2>
        </div>
        <p className="text-sm text-muted-foreground">Update your account password. For security, choose a strong, unique password that you don't use for other services.</p>
      </div>
      <ChangePasswordForm />
    </>
  );
}
