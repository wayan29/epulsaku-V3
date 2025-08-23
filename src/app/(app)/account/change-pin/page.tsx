// src/app/(app)/account/change-pin/page.tsx
"use client";
import ChangePinForm from "@/components/account/ChangePinForm";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { redirect } from 'next/navigation';


export default function ChangePinPage() {
    const { user } = useAuth();
    if (!user) {
      redirect('/login');
    }
    
  return (
    <>
       <div className="p-0 mb-6 max-w-xl">
         <div className="flex items-center gap-3 mb-2">
          <KeyRound className="h-7 w-7 text-primary" />
          <h2 className="text-xl font-semibold font-headline">Change Transaction PIN</h2>
        </div>
        <p className="text-sm text-muted-foreground">Update your 6-digit transaction PIN. You will need to confirm this change with your account password for security.</p>
      </div>
      <ChangePinForm />
    </>
  );
}
