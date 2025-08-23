// src/app/(app)/admin-settings/page.tsx
"use client";

import { useEffect, useState } from 'react';
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; 
import { Card, CardContent, CardDescription as PageCardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, ShieldAlert, KeyRound, Smartphone, Globe, Settings, ShoppingCart, Lock, Send as SendIcon, UserCircle2, Info } from "lucide-react"; 
import { getAdminSettingsFromDB, saveAdminSettingsToDB, type AdminSettings } from '@/lib/admin-settings-utils';
import ProtectedRoute from '@/components/core/ProtectedRoute';

const adminSettingsFormSchema = z.object({
  digiflazzUsername: z.string().optional(),
  digiflazzApiKey: z.string().optional(),
  digiflazzWebhookSecret: z.string().optional(),
  allowedDigiflazzIPs: z.string().optional(),
  allowedTokoVoucherIPs: z.string().optional(),
  tokovoucherMemberCode: z.string().optional(),
  tokovoucherSignature: z.string().optional(),
  tokovoucherKey: z.string().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  adminPasswordConfirmation: z.string().min(1, "Admin password is required to save settings"),
});

type AdminSettingsFormValues = z.infer<typeof adminSettingsFormSchema>;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);

  const form = useForm<AdminSettingsFormValues>({
    resolver: zodResolver(adminSettingsFormSchema),
    defaultValues: {
      digiflazzUsername: "",
      digiflazzApiKey: "",
      digiflazzWebhookSecret: "",
      allowedDigiflazzIPs: "",
      allowedTokoVoucherIPs: "",
      tokovoucherMemberCode: "",
      tokovoucherSignature: "",
      tokovoucherKey: "",
      telegramBotToken: "",
      telegramChatId: "",
      adminPasswordConfirmation: "",
    },
  });

  useEffect(() => {
    async function fetchInitialSettings() {
      setIsFetchingInitial(true);
      try {
        const storedSettings = await getAdminSettingsFromDB(); 
        if (storedSettings) {
          form.reset({
            digiflazzUsername: storedSettings.digiflazzUsername || "",
            digiflazzApiKey: storedSettings.digiflazzApiKey || "",
            digiflazzWebhookSecret: storedSettings.digiflazzWebhookSecret || "",
            allowedDigiflazzIPs: storedSettings.allowedDigiflazzIPs || "",
            allowedTokoVoucherIPs: storedSettings.allowedTokoVoucherIPs || "",
            tokovoucherMemberCode: storedSettings.tokovoucherMemberCode || "",
            tokovoucherSignature: storedSettings.tokovoucherSignature || "",
            tokovoucherKey: storedSettings.tokovoucherKey || "",
            telegramBotToken: storedSettings.telegramBotToken || "",
            telegramChatId: storedSettings.telegramChatId || "",
            adminPasswordConfirmation: "", 
          });
        }
      } catch (error) {
        console.error("Failed to fetch initial admin settings:", error);
        toast({
          title: "Error Loading Settings",
          description: "Could not fetch existing settings from the database.",
          variant: "destructive",
        });
      } finally {
        setIsFetchingInitial(false);
      }
    }
    fetchInitialSettings();
  }, [form, toast]);

  async function onSubmit(values: AdminSettingsFormValues) {
    if (!authUser) {
      toast({ title: "Authentication Error", description: "Admin user not authenticated.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const settingsToSave: Omit<AdminSettings, '_id'> = {
        digiflazzUsername: values.digiflazzUsername,
        digiflazzApiKey: values.digiflazzApiKey,
        digiflazzWebhookSecret: values.digiflazzWebhookSecret,
        allowedDigiflazzIPs: values.allowedDigiflazzIPs,
        allowedTokoVoucherIPs: values.allowedTokoVoucherIPs,
        tokovoucherMemberCode: values.tokovoucherMemberCode,
        tokovoucherSignature: values.tokovoucherSignature,
        tokovoucherKey: values.tokovoucherKey,
        telegramBotToken: values.telegramBotToken,
        telegramChatId: values.telegramChatId,
      };
      const result = await saveAdminSettingsToDB({
        settings: settingsToSave,
        adminPasswordConfirmation: values.adminPasswordConfirmation,
        adminUsername: authUser.username,
      });

      if (result.success) {
        toast({
          title: "Settings Saved",
          description: "Admin settings have been successfully updated and encrypted.",
        });
        form.setValue("adminPasswordConfirmation", ""); 
        const storedSettings = await getAdminSettingsFromDB(); 
        form.reset({ ...storedSettings, adminPasswordConfirmation: "" });

      } else {
        toast({
          title: "Error Saving Settings",
          description: result.message || "Could not save settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error Saving Settings",
        description: `Could not save settings to the database: ${message}`,
        variant: "destructive",
      });
      console.error("Error saving admin settings:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ProtectedRoute requiredPermission='pengaturan_admin'>
    <div className="space-y-8 max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center gap-2">
            <Settings className="h-7 w-7 text-primary" />
            Admin Settings
          </CardTitle>
          <PageCardDescription>
            Manage application credentials and webhook configurations. Sensitive data (API keys, secrets, tokens) will be encrypted at rest. Password confirmation is required to save any changes.
          </PageCardDescription>
        </CardHeader>
        <CardContent>
          <Card className="border-blue-500/50 bg-blue-500/5 mb-6">
            <CardContent className="p-4 text-blue-700 text-sm flex items-start gap-2">
              <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="font-semibold">Note on Encryption:</strong> Fields marked with a lock icon are encrypted. If a field has a value, it will appear empty for security. To update it, simply type the new value. To clear it, submit an empty value for that field.
              </div>
            </CardContent>
          </Card>

          {isFetchingInitial ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading settings...</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <fieldset className="space-y-4 p-4 border rounded-md">
                  <legend className="text-lg font-medium text-primary px-1">Digiflazz Credentials</legend>
                  <FormField
                    control={form.control}
                    name="digiflazzUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Smartphone className="mr-2 h-4 w-4 text-muted-foreground" />Digiflazz Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Digiflazz Username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="digiflazzApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Digiflazz API Key (Production)</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={field.value ? "•••••••• (Encrypted)" : "Your Digiflazz API Key"} {...field} value="" onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="digiflazzWebhookSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Digiflazz Webhook Secret</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={field.value ? "•••••••• (Encrypted)" : "Your Digiflazz Webhook Secret Key"} {...field} value="" onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowedDigiflazzIPs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-muted-foreground" />Allowed Digiflazz IPs</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., 1.2.3.4,5.6.7.8 (comma-separated, optional)" {...field} />
                        </FormControl>
                         <FormDescription className="text-xs">Leave blank if IP filtering is not desired or handled elsewhere. Separate multiple IPs with a comma.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>

                <fieldset className="space-y-4 p-4 border rounded-md">
                  <legend className="text-lg font-medium text-primary px-1">TokoVoucher Credentials</legend>
                  <FormField
                    control={form.control}
                    name="tokovoucherMemberCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><ShoppingCart className="mr-2 h-4 w-4 text-muted-foreground" />TokoVoucher Member Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Your TokoVoucher Member Code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tokovoucherSignature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />TokoVoucher Signature (for API Info)</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={field.value ? "•••••••• (Encrypted)" : "Your TokoVoucher Signature"} {...field} value="" onChange={field.onChange}/>
                        </FormControl>
                        <FormDescription className="text-xs">Usually for API calls like get balance, get products.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="tokovoucherKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />TokoVoucher Key/Secret (for Transactions & Webhook)</FormLabel>
                        <FormControl>
                           <Input type="password" placeholder={field.value ? "•••••••• (Encrypted)" : "Your TokoVoucher API Key/Secret"} {...field} value="" onChange={field.onChange}/>
                        </FormControl>
                         <FormDescription className="text-xs">Used for placing orders and verifying webhooks.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="allowedTokoVoucherIPs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-muted-foreground" />Allowed TokoVoucher IPs</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., 188.166.243.56 (comma-separated, optional)" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">Leave blank if IP filtering is not desired. Separate multiple IPs with a comma.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>

                <fieldset className="space-y-4 p-4 border rounded-md">
                  <legend className="text-lg font-medium text-primary px-1">Telegram Notifications</legend>
                  <FormField
                    control={form.control}
                    name="telegramBotToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><SendIcon className="mr-2 h-4 w-4 text-muted-foreground" />Telegram Bot Token</FormLabel>
                        <FormControl>
                           <Input type="password" placeholder={field.value ? "•••••••• (Encrypted)" : "Your Telegram Bot Token"} {...field} value="" onChange={field.onChange} />
                        </FormControl>
                        <FormDescription className="text-xs">Get this from BotFather on Telegram.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="telegramChatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><UserCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />Telegram Chat ID(s)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 12345,67890,-100123" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">Your personal Chat ID or Group IDs. Separate multiple Chat IDs with a comma.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>

                <FormField
                  control={form.control}
                  name="adminPasswordConfirmation"
                  render={({ field }) => (
                    <FormItem className="pt-4">
                      <FormLabel className="flex items-center text-md font-semibold text-destructive"><Lock className="mr-2 h-5 w-5 text-destructive" />Confirm with Admin Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your current admin password" {...field} className="border-destructive focus:border-destructive" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading || isFetchingInitial}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Settings
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
    </ProtectedRoute>
  );
}
