
// src/app/(app)/tools/pln-checker/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardContent } from "@/components/ui/card";
import { Loader2, Zap, Search, AlertTriangle, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inquirePlnCustomer, type InquirePlnCustomerOutput } from '@/ai/flows/inquire-pln-customer-flow';
import ProtectedRoute from "@/components/core/ProtectedRoute";

const formSchema = z.object({
  customerNo: z.string().min(10, "Customer number must be at least 10 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export default function PlnCheckerPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [inquiryResult, setInquiryResult] = useState<InquirePlnCustomerOutput | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { customerNo: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setInquiryResult(null);
    try {
      const result = await inquirePlnCustomer({ customerNo: data.customerNo });
      setInquiryResult(result);
      if (result.isSuccess) {
        toast({ title: "Inquiry Successful", description: `Customer found: ${result.customerName}` });
      } else {
        toast({ title: "Inquiry Failed", description: result.message || "Could not verify customer ID.", variant: "destructive" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setInquiryResult({ isSuccess: false, message: `Error: ${errorMessage}` });
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderResult = () => {
    if (!inquiryResult) return null;

    return (
      <div className={`mt-6 p-4 rounded-md text-sm ${inquiryResult.isSuccess ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
        {inquiryResult.isSuccess ? (
          <>
            <p className="font-semibold flex items-center"><UserCheck className="h-4 w-4 mr-2" />Customer Found:</p>
            <p><strong>Name:</strong> {inquiryResult.customerName}</p>
            {inquiryResult.meterNo && <p><strong>Meter No:</strong> {inquiryResult.meterNo}</p>}
            {inquiryResult.subscriberId && <p><strong>Subscriber ID:</strong> {inquiryResult.subscriberId}</p>}
            {inquiryResult.segmentPower && <p><strong>Segment/Power:</strong> {inquiryResult.segmentPower}</p>}
          </>
        ) : (
          <p className="font-semibold flex items-center"><AlertTriangle className="h-4 w-4 mr-2" />Inquiry Failed: <span className="font-normal ml-1">{inquiryResult.message}</span></p>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute requiredPermission="cek_id_pln">
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="customerNo" className="flex items-center">
              <Zap className="mr-2 h-4 w-4 text-muted-foreground" />
              PLN Customer Number / Meter ID
            </Label>
            <Input id="customerNo" placeholder="Enter PLN Customer Number" {...register("customerNo")} disabled={isLoading} />
            {errors.customerNo && <p className="text-sm text-destructive">{errors.customerNo.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Check Customer ID
          </Button>
        </form>
        {renderResult()}
      </CardContent>
    </ProtectedRoute>
  );
}
