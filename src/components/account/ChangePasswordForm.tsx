// src/components/account/ChangePasswordForm.tsx
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
import { Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { changePassword } from "@/lib/user-utils";

const formSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"],
});

type ChangePasswordFormValues = z.infer<typeof formSchema>;

export default function ChangePasswordForm() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const result = await changePassword(user.username, values.oldPassword, values.newPassword);
      if (result.success) {
        toast({
          title: "Password Changed Successfully",
          description: "Your password has been updated. Please log in again with your new password.",
          duration: 5000,
        });
        await logout(); // Use the logout function from context
      } else {
        toast({
          title: "Failed to Change Password",
          description: result.message || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Change password error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while changing password.",
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
          name="oldPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />Old Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your current password" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your new password" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmNewPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />Confirm New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Re-enter your new password" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Change Password
        </Button>
      </form>
    </Form>
  );
}
