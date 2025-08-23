// src/app/(auth)/signup/page.tsx
import SignupForm from "@/components/auth/SignupForm";
import { checkIfUsersExist } from "@/lib/user-utils"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SignupPage() {
  const usersExist = await checkIfUsersExist();

  if (usersExist) {
    return (
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-3xl font-headline">Signup Disabled</CardTitle>
          <CardDescription>
            A user account already exists. Signup is only available for the first user.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            If you have an account, please log in.
          </p>
          <Button asChild className="mt-4">
            <Link href="/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <SignupForm />;
}
