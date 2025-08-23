
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { verifyPin } from '@/ai/flows/verify-pin-flow';
import {
    createTokoVoucherDeposit,
    type CreateTokoVoucherDepositOutput,
    type TokoVoucherPaymentMethodCode
} from "@/ai/flows/tokovoucher/createTokoVoucherDeposit-flow";
import { PiggyBank, Landmark, KeyRound, Info, CheckCircle, AlertTriangle, Copy, Loader2, QrCode, CreditCard } from "lucide-react";

const baseTokoVoucherDepositFormSchema = z.object({
  nominal: z.number().min(10000, "Minimum deposit Rp 10,000").describe('The amount of deposit requested.'),
  kode_bayar: z.enum(["bca", "qris", "briva"] as [TokoVoucherPaymentMethodCode, ...TokoVoucherPaymentMethodCode[]]).describe('Payment method code.'),
});

const tokoVoucherDepositFormSchema = baseTokoVoucherDepositFormSchema.extend({
  pin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/, "PIN must be only digits"),
});

type TokoVoucherDepositFormValues = z.infer<typeof tokoVoucherDepositFormSchema>;

interface TokoVoucherDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDepositSuccess?: () => void;
}

export default function TokoVoucherDepositDialog({ open, onOpenChange, onDepositSuccess }: TokoVoucherDepositDialogProps) {
  const { toast } = useToast();
  const { user: authUser, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [depositResult, setDepositResult] = useState<CreateTokoVoucherDepositOutput | null>(null);

  const form = useForm<TokoVoucherDepositFormValues>({
    resolver: zodResolver(tokoVoucherDepositFormSchema),
    defaultValues: {
      nominal: undefined,
      kode_bayar: undefined,
      pin: "",
    },
  });

  const paymentMethodOptions: { label: string; value: TokoVoucherPaymentMethodCode, icon?: React.ElementType }[] = [
    { label: "QRIS (All Payment)", value: "qris", icon: QrCode },
    { label: "BCA Transfer", value: "bca", icon: CreditCard },
    { label: "BRI Virtual Account", value: "briva", icon: CreditCard },
  ];

  const handleDialogClose = () => {
    form.reset();
    setIsLoading(false);
    setDepositResult(null);
    onOpenChange(false);
  };

  const onSubmit = async (values: TokoVoucherDepositFormValues) => {
    if (!authUser) {
      toast({ title: "Authentication Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setDepositResult(null);

    try {
      const pinResponse = await verifyPin({ username: authUser.username, pin: values.pin });
      if (!pinResponse.isValid) {
        toast({ title: "PIN Invalid", description: pinResponse.message || "Incorrect PIN.", variant: "destructive" });
        form.setError("pin", { type: "manual", message: pinResponse.message || "Invalid PIN." });
        setIsLoading(false);
        if (pinResponse.accountDisabled) {
            toast({
                title: "Account Disabled",
                description: "Your account has been locked due to too many failed PIN attempts.",
                variant: "destructive",
                duration: 7000
            });
            await logout();
        }
        return;
      }

      const depositInput = {
        nominal: values.nominal,
        kode_bayar: values.kode_bayar,
      };
      const result = await createTokoVoucherDeposit(depositInput);
      setDepositResult(result);

      if (result.isSuccess && result.data) {
        toast({
          title: "Deposit Ticket Created (TokoVoucher)",
          description: "Please complete your payment as instructed.",
          duration: 7000,
        });
        onDepositSuccess?.();
      } else {
        toast({
          title: "Deposit Failed (TokoVoucher)",
          description: result.message || "Could not create deposit ticket.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("TokoVoucher Deposit process error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      setDepositResult({ isSuccess: false, message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string | number | undefined | null, fieldName: string) => {
    if (!text) return;
    const textToCopy = typeof text === 'number' ? text.toString() : text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast({ title: "Copied to Clipboard", description: `${fieldName} copied successfully.` });
    }).catch(err => {
      toast({ title: "Copy Failed", description: `Could not copy ${fieldName}.`, variant: "destructive" });
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isLoading || !isOpen) handleDialogClose(); else onOpenChange(isOpen);}}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-primary" />
            Request TokoVoucher Deposit
          </DialogTitle>
          {!depositResult && (
            <DialogDescription>
              Fill in to request a TokoVoucher deposit ticket. PIN required.
            </DialogDescription>
          )}
        </DialogHeader>

        {!depositResult ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="nominal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Info className="mr-2 h-4 w-4 text-muted-foreground" />Amount</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 50000" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || undefined)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kode_bayar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Landmark className="mr-2 h-4 w-4 text-muted-foreground" />Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethodOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              {option.icon && <option.icon className="h-4 w-4 text-muted-foreground" />}
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2 py-4 bg-muted/70 rounded-lg p-4 my-2">
                <FormLabel htmlFor="pinTokoVoucherDeposit" className="flex items-center justify-center text-sm font-medium text-foreground/80">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Transaction PIN
                </FormLabel>
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <Input
                          id="pinTokoVoucherDeposit"
                          type="password"
                          placeholder="● ● ● ● ● ●"
                          maxLength={6}
                          className="text-center tracking-[0.5em] text-xl bg-background border-primary/50 focus:border-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-center pt-2" />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Request Ticket
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="py-4 space-y-4">
            {depositResult.isSuccess && depositResult.data ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700 space-y-2">
                  <h3 className="font-semibold text-lg flex items-center"><CheckCircle className="h-5 w-5 mr-2"/>Deposit Ticket Created!</h3>
                  <p>Please complete your payment using the details below. RC: {depositResult.rc}</p>
                </div>
                <div className="space-y-3 text-sm">
                  <p><strong>Metode:</strong> {depositResult.data.metode}</p>

                  {depositResult.data.metode.toLowerCase().includes("qris") && depositResult.data.pay.startsWith("https://") ? (
                    <div className="text-center">
                       <p className="mb-2">Scan QRIS below:</p>
                      <Image src={depositResult.data.pay} alt="QRIS Payment" width={250} height={250} className="mx-auto rounded-md border shadow-md" data-ai-hint="qr code" />
                    </div>
                  ) : (
                    <div className="flex justify-between items-center p-3 bg-card rounded-md border">
                      <div>
                        <span className="text-muted-foreground">{depositResult.data.metode.toLowerCase().includes("virtual") ? "Virtual Account:" : "No. Rekening:"}</span>
                        <p className="font-bold text-lg text-primary">{depositResult.data.pay}</p>
                      </div>
                       <Button variant="ghost" size="sm" onClick={() => copyToClipboard(depositResult.data.pay, 'Payment Number')}>
                         <Copy className="h-4 w-4 mr-1" /> Copy
                       </Button>
                    </div>
                  )}

                  {depositResult.data.pay_name && <p><strong>Atas Nama:</strong> {depositResult.data.pay_name}</p>}

                  <div className="flex justify-between items-center p-3 bg-card rounded-md border">
                    <div>
                      <span className="text-muted-foreground">Total Transfer:</span>
                      <p className="font-bold text-xl text-primary">Rp {depositResult.data.total_transfer.toLocaleString()}</p>
                    </div>
                     <Button variant="ghost" size="sm" onClick={() => copyToClipboard(depositResult.data.total_transfer, 'Total Transfer')}>
                       <Copy className="h-4 w-4 mr-1" /> Copy
                     </Button>
                  </div>

                  <p className="text-xs">Nominal: Rp {depositResult.data.nominal.toLocaleString()}</p>
                  {typeof depositResult.data.kode_unik === 'number' && <p className="text-xs">Kode Unik: {depositResult.data.kode_unik}</p>}
                  {typeof depositResult.data.biaya_admin === 'number' && <p className="text-xs">Biaya Admin: Rp {depositResult.data.biaya_admin.toLocaleString()}</p>}
                  <p className="text-xs">Dibuat: {new Date(depositResult.data.created).toLocaleDateString('id-ID')}</p>
                  <p className="text-xs">Kadaluarsa: {new Date(depositResult.data.expired_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <DialogFooter className="pt-4">
                  <Button onClick={handleDialogClose} className="w-full">Close</Button>
                </DialogFooter>
              </>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 space-y-2">
                <h3 className="font-semibold text-lg flex items-center"><AlertTriangle className="h-5 w-5 mr-2"/>Deposit Request Failed</h3>
                <p>{depositResult.message || "An unknown error occurred."}</p>
                {depositResult.rc && <p className="text-xs">Response Code: {depositResult.rc}</p>}
                <DialogFooter className="pt-4">
                    <Button variant="outline" onClick={() => setDepositResult(null)} className="w-full sm:w-auto">Try Again</Button>
                    <Button onClick={handleDialogClose} className="w-full sm:w-auto">Close</Button>
                </DialogFooter>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
