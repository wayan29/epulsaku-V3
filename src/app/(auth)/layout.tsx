// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import { ModeToggle } from "@/components/core/ModeToggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
