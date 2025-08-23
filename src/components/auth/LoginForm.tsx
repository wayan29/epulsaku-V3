// src/components/auth/LoginForm.tsx
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { UserCircle2, Lock, Zap, Loader2, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  username: z.string().min(1, "Username cannot be empty"),
  password: z.string().min(1, "Password cannot be empty"),
  rememberMe: z.boolean().default(false).optional(),
});

export default function LoginForm() {
  const { toast } = useToast();
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [lockoutTime, setLockoutTime] = useState(0);
  const isLockedOut = lockoutTime > 0;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: true,
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
        router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (isLockedOut) {
      timer = setInterval(() => {
        setLockoutTime((prevTime) => prevTime - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLockedOut]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await login(values.username, values.password, values.rememberMe);
      toast({
        title: "Login Successful",
        description: "Redirecting to your dashboard...",
      });
    } catch (error) {
       const err = error as Error & { response?: Response, data?: any };
       const errorMessage = err.data?.message || err.message || "An unknown error occurred.";
       
       if (err.response?.status === 429) {
          const lockout = err.data?.lockoutTime || 120;
          setLockoutTime(lockout);
          toast({
            title: "Login Locked",
            description: errorMessage,
            variant: "destructive",
          });
       } else {
          toast({
            title: "Login Failed",
            description: errorMessage,
            variant: "destructive",
          });
       }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex items-center justify-center">
          <Zap className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Welcome to ePulsaku</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        {isLockedOut && (
            <Alert variant="destructive" className="mb-4">
                <Timer className="h-4 w-4" />
                <AlertDescription>
                    Too many failed attempts. Please try again in <span className="font-bold">{lockoutTime}</span> seconds.
                </AlertDescription>
            </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><UserCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />Username</FormLabel>
                  <FormControl>
                    <Input placeholder="yourusername" {...field} disabled={isSubmitting || isLockedOut} />
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
                    <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting || isLockedOut} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting || isLockedOut}
                      id="remember-me"
                    />
                  </FormControl>
                  <Label htmlFor="remember-me" className="text-sm font-normal text-muted-foreground cursor-pointer">
                    Remember me on this device
                  </Label>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLockedOut}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Logging in..." : (isLockedOut ? `Try again in ${lockoutTime}s` : "Login")}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          First time setup?{" "}
          <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
            Create Admin Account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
