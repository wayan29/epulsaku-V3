// src/components/core/providers.tsx
"use client";

import { ThemeProvider } from "./ThemeProvider";
import type { ReactNode } from "react";

// This is a wrapper to provide the theme to the entire app.
// User/Auth context will be handled at a different level.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
