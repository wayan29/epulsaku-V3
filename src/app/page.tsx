// src/app/page.tsx
import { verifyAuth } from "@/app/api/auth/actions";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { isAuthenticated } = await verifyAuth();

  if (isAuthenticated) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
