// src/components/auth/SignupForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserCircle2, Lock, Zap, Mail, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { createUser } from "@/lib/user-utils";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  pin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/, "PIN must be only digits"),
  confirmPin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/, "PIN must be only digits"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.pin === data.confirmPin, {
  message: "PINs don't match",
  path: ["confirmPin"],
});

export default function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      pin: "",
      confirmPin: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const result = await createUser({
        username: values.username,
        email: values.email,
        passwordPlain: values.password,
        pinPlain: values.pin,
        // Role is determined server-side
      });

      if (result.success) {
        toast({
          title: "Signup Successful",
          description: `Welcome, ${result.user?.username}! Your super admin account has been created. Please log in.`,
        });
        router.push('/login');
      } else {
        toast({
          title: "Signup Failed",
          description: result.message || "Could not create your account.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
         <div className="mx-auto mb-4 flex items-center justify-center">
          <Zap className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Create Super Admin Account</CardTitle>
        <CardDescription>Set up the first administrator account for ePulsaku. This user will have all permissions.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><UserCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />Username</FormLabel>
                  <FormControl>
                    <Input placeholder="youradminusername" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />6-Digit Transaction PIN</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="●●●●●●" {...field} maxLength={6} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Confirm PIN</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="●●●●●●" {...field} maxLength={6} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
