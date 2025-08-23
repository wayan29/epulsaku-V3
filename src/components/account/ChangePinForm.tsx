// src/components/account/ChangePinForm.tsx
"use client";

import { useState } from "react";
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
import { Loader2, KeyRound, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { changePin } from "@/lib/user-utils"; // Server Action

const formSchema = z.object({
  newPin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/, "PIN must be only digits"),
  confirmNewPin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/, "PIN must be only digits"),
  currentPassword: z.string().min(1, "Current password is required to authorize PIN change"),
}).refine((data) => data.newPin === data.confirmNewPin, {
  message: "New PINs don't match",
  path: ["confirmNewPin"],
});

type ChangePinFormValues = z.infer<typeof formSchema>;

export default function ChangePinForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ChangePinFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPin: "",
      confirmNewPin: "",
      currentPassword: "",
    },
  });

  async function onSubmit(values: ChangePinFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const result = await changePin(user.username, values.currentPassword, values.newPin);
      if (result.success) {
        toast({
          title: "PIN Changed",
          description: "Your transaction PIN has been updated successfully. Failed attempt counter has been reset.",
        });
        form.reset();
      } else {
        toast({
          title: "Failed to Change PIN",
          description: result.message || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Change PIN error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while changing PIN.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="newPin"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />New 6-Digit PIN</FormLabel>
              <FormControl>
                <Input type="password" placeholder="●●●●●●" {...field} maxLength={6} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmNewPin"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Confirm New PIN</FormLabel>
              <FormControl>
                <Input type="password" placeholder="●●●●●●" {...field} maxLength={6} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />Current Account Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your account password" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Change PIN
        </Button>
      </form>
    </Form>
  );
}
