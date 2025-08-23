
// src/app/(app)/order/token-listrik/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OrderFormShell from "@/components/order/OrderFormShell";
import { Zap, AlertTriangle, Loader2, ShieldCheck, Send, Search, RefreshCw, UserCheck, KeyRound, CheckCircle, Clock, ListChecks, Tag, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { verifyPin } from '@/ai/flows/verify-pin-flow';
import { fetchDigiflazzProducts, type DigiflazzProduct } from '@/ai/flows/fetch-digiflazz-products-flow';
import { inquirePlnCustomer, type InquirePlnCustomerOutput } from '@/ai/flows/inquire-pln-customer-flow';
import { purchaseDigiflazzProduct } from '@/ai/flows/purchase-digiflazz-product-flow';
import { addTransactionToDB } from '@/lib/transaction-utils';
import { generateRefId } from '@/lib/client-utils';
import { trySendTelegramNotification, type TelegramNotificationDetails } from '@/lib/notification-utils';
import type { TransactionStatus, NewTransactionInput } from '@/components/transactions/TransactionItem';
import { getCustomSellingPrice } from '@/lib/price-settings-utils';
import { Skeleton } from '@/components/ui/skeleton';


import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const tokenListrikOrderFormSchema = z.object({
  meterNumber: z.string().min(10, "Nomor meter minimal 10 digit").max(13, "Nomor meter maksimal 13 digit").regex(/^\d+$/, "Nomor meter hanya boleh berisi angka"),
});

type TokenListrikOrderFormValues = z.infer<typeof tokenListrikOrderFormSchema>;

const RELEVANT_PLN_CATEGORIES_UPPER = ["PLN", "TOKEN LISTRIK", "TOKEN"];

interface SubmittedTokenListrikOrderInfo {
  refId: string;
  productName: string;
  meterNumber: string;
  plnCustomerName?: string;
  costPrice: number;
  sellingPrice: number;
  profit?: number;
  status: TransactionStatus;
  message?: string | null;
  sn?: string | null;
}

export default function TokenListrikOrderPage() {
  const { toast } = useToast();
  const { user: authUser, logout } = useAuth();
  const router = useRouter();

  const [allApiProducts, setAllApiProducts] = useState<DigiflazzProduct[]>([]);
  const [isLoadingApiProducts, setIsLoadingApiProducts] = useState(true);
  const [apiProductsError, setApiProductsError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<DigiflazzProduct | null>(null);
  const [meterInquiryResult, setMeterInquiryResult] = useState<InquirePlnCustomerOutput | null>(null);

  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSubmittingWithPin, setIsSubmittingWithPin] = useState(false);

  const [isMeterChecked, setIsMeterChecked] = useState(false);
  const [isCheckingMeter, setIsCheckingMeter] = useState(false);
  const [meterCheckError, setMeterCheckError] = useState<string | null>(null);
  const [isRefreshingPricelist, setIsRefreshingPricelist] = useState(false);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<SubmittedTokenListrikOrderInfo | null>(null);

  const form = useForm<TokenListrikOrderFormValues>({
    resolver: zodResolver(tokenListrikOrderFormSchema),
    defaultValues: {
      meterNumber: "",
    },
  });
  const watchedMeterNumber = form.watch('meterNumber');

  const loadAllApiProducts = async (forceRefresh = false) => {
    if (!forceRefresh) setIsLoadingApiProducts(true);
    else setIsRefreshingPricelist(true);

    setApiProductsError(null);
    if (forceRefresh) {
        setSelectedProduct(null);
        setLastSubmittedOrder(null);
    }

    try {
      const productsData = await fetchDigiflazzProducts({ forceRefresh });
      setAllApiProducts(productsData);
      if (forceRefresh) {
        toast({
            title: "Pricelist Refreshed",
            description: "Successfully updated product list from Digiflazz.",
        });
      }
    } catch (error) {
      console.error("Failed to load Digiflazz API products for PLN:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load products.";
      setApiProductsError(errorMessage);
      toast({
        title: forceRefresh ? "Refresh Failed" : "Error Loading Products",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (!forceRefresh) setIsLoadingApiProducts(false);
      else setIsRefreshingPricelist(false);
    }
  };

  useEffect(() => {
    loadAllApiProducts(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isMeterChecked) {
      setIsMeterChecked(false);
      setMeterInquiryResult(null);
      setSelectedProduct(null);
      setMeterCheckError(null);
      setLastSubmittedOrder(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedMeterNumber]);

  const handleCheckMeterNumber = async () => {
    setIsCheckingMeter(true);
    setMeterCheckError(null);
    setMeterInquiryResult(null);
    setSelectedProduct(null);
    setLastSubmittedOrder(null);

    const currentMeterNumber = form.getValues('meterNumber');

    if (!currentMeterNumber || currentMeterNumber.length < 10) {
      setMeterCheckError("Masukkan nomor meter PLN yang valid (minimal 10 digit).");
      setIsMeterChecked(true);
      setIsCheckingMeter(false);
      return;
    }

    if (isLoadingApiProducts && allApiProducts.length === 0) {
      setMeterCheckError("Daftar produk masih dimuat, tunggu sebentar lalu coba lagi.");
      setIsMeterChecked(true);
      setIsCheckingMeter(false);
      return;
    }
    if (apiProductsError && allApiProducts.length === 0) {
      setMeterCheckError(`Gagal memuat produk: ${apiProductsError}. Tidak dapat memeriksa nomor meter.`);
      setIsMeterChecked(true);
      setIsCheckingMeter(false);
      return;
    }

    try {
      const result = await inquirePlnCustomer({ customerNo: currentMeterNumber });
      setMeterInquiryResult(result);
      if (!result.isSuccess) {
        setMeterCheckError(result.message || "Gagal memverifikasi nomor meter. Pastikan nomor sudah benar.");
      }
    } catch (error) {
      console.error("PLN Inquiry system error:", error);
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
      setMeterInquiryResult({ isSuccess: false, message: `Error: ${errorMessage}` });
      setMeterCheckError(`Error sistem saat cek ID PLN: ${errorMessage}`);
    } finally {
      setIsMeterChecked(true);
      setIsCheckingMeter(false);
    }
  };

  const availableProducts = useMemo(() => {
    if (!isMeterChecked || isLoadingApiProducts || apiProductsError) {
        return [];
    }

    const relevantProducts = allApiProducts.filter(p => {
        const productBrandUpper = p.brand.toUpperCase();
        const productCategoryUpper = p.category.toUpperCase();

        const brandMatch = productBrandUpper === "PLN" || productBrandUpper.includes("LISTRIK");
        const categoryMatch = RELEVANT_PLN_CATEGORIES_UPPER.some(cat => productCategoryUpper.includes(cat));

        return brandMatch && categoryMatch;
    }).sort((a, b) => a.price - b.price);

    if (relevantProducts.length === 0 && isMeterChecked && !meterCheckError && meterInquiryResult?.isSuccess && !meterInquiryResult?.message?.includes("Gagal memuat produk")) {
        setTimeout(() => setMeterCheckError(`Tidak ada produk token listrik yang ditemukan saat ini.`), 0);
    } else if (relevantProducts.length > 0 && meterCheckError && meterCheckError.startsWith("Tidak ada produk")) {
         setTimeout(() => setMeterCheckError(null), 0);
    }

    return relevantProducts;
  }, [allApiProducts, isMeterChecked, meterInquiryResult, isLoadingApiProducts, apiProductsError, meterCheckError]);


  const handleProductSelect = (product: DigiflazzProduct) => {
    const isActive = product.buyer_product_status && product.seller_product_status;
    if (!isActive) {
        toast({
            title: "Produk Tidak Tersedia",
            description: `${product.product_name} saat ini tidak tersedia untuk dibeli.`,
            variant: "default"
        });
        return;
    }
    setSelectedProduct(product);
    setLastSubmittedOrder(null);
  };

  const onSubmitOrder = () => {
    if (!selectedProduct) {
      toast({ title: "Belum Ada Produk Dipilih", description: "Silakan pilih produk token listrik.", variant: "destructive" });
      return;
    }
    if (!meterInquiryResult?.isSuccess) {
      toast({ title: "Nomor Meter Belum Terverifikasi", description: "Pastikan nomor meter telah dicek dan valid.", variant: "destructive" });
      return;
    }
    const isActive = selectedProduct.buyer_product_status && selectedProduct.seller_product_status;
    if (!isActive) {
        toast({ title: "Produk Tidak Aktif", description: "Produk yang dipilih tidak tersedia.", variant: "destructive" });
        return;
    }
    setIsConfirmingOrder(true);
    setPinInput("");
    setPinError("");
  };

  const handlePinConfirm = async () => {
    if (!selectedProduct || !authUser || !meterInquiryResult?.isSuccess) {
      setPinError("Detail order, sesi pengguna, atau verifikasi meter hilang. Coba lagi.");
      setIsSubmittingWithPin(false);
      return;
    }
    const isActive = selectedProduct.buyer_product_status && selectedProduct.seller_product_status;
    if (!isActive) {
      setPinError("Produk tidak lagi tersedia.");
      setIsSubmittingWithPin(false);
      return;
    }

    setIsSubmittingWithPin(true);
    setPinError("");

    const refId = `DF-${generateRefId()}`;
    const meterNumber = form.getValues("meterNumber");

    try {
      const pinResponse = await verifyPin({ username: authUser.username, pin: pinInput });
      if (!pinResponse.isValid) {
        setPinError(pinResponse.message || "PIN salah.");
        setIsSubmittingWithPin(false);
        if (pinResponse.accountDisabled) {
            toast({
              title: "Account Disabled",
              description: "Your account has been locked and you have been logged out. Please contact a super administrator.",
              variant: "destructive",
              duration: 10000,
            });
            logout();
        }
        return;
      }

      const purchaseResponse = await purchaseDigiflazzProduct({
        buyerSkuCode: selectedProduct.buyer_sku_code,
        customerNo: meterNumber,
        refId: refId,
      });

      const clientSideSellingPriceEstimate = getCustomSellingPrice(selectedProduct.buyer_sku_code, 'digiflazz') || 
                                          (selectedProduct.price < 20000 ? selectedProduct.price + 1000 : 
                                          selectedProduct.price <= 50000 ? selectedProduct.price + 1500 : 
                                          selectedProduct.price + 2000);

      const newTxInput: NewTransactionInput = {
        id: refId,
        productName: selectedProduct.product_name,
        details: `${meterNumber} (${meterInquiryResult.customerName || 'N/A'})`,
        costPrice: selectedProduct.price,
        sellingPrice: clientSideSellingPriceEstimate,
        status: purchaseResponse.status as TransactionStatus || "Gagal",
        timestamp: new Date().toISOString(),
        serialNumber: purchaseResponse.sn || undefined,
        failureReason: purchaseResponse.status === "Gagal" ? purchaseResponse.message : undefined,
        buyerSkuCode: selectedProduct.buyer_sku_code,
        originalCustomerNo: meterNumber,
        productCategoryFromProvider: selectedProduct.category,
        productBrandFromProvider: selectedProduct.brand,
        provider: 'digiflazz',
        transactedBy: authUser.username,
      };
      
      await addTransactionToDB(newTxInput, authUser.username);

      let profitForSummary: number | undefined = undefined;
      if (purchaseResponse.status === "Sukses") {
          profitForSummary = clientSideSellingPriceEstimate - selectedProduct.price;
      }

      const notificationDetails: TelegramNotificationDetails = {
        refId: refId,
        productName: selectedProduct.product_name,
        customerNoDisplay: `${meterNumber} (${meterInquiryResult.customerName || 'N/A'})`,
        status: purchaseResponse.status as TransactionStatus || "Gagal",
        provider: 'Digiflazz',
        costPrice: selectedProduct.price,
        sellingPrice: clientSideSellingPriceEstimate,
        profit: profitForSummary,
        sn: purchaseResponse.sn || null,
        failureReason: purchaseResponse.status === "Gagal" ? purchaseResponse.message : null,
        timestamp: new Date(),
        transactedBy: authUser.username,
      };
      trySendTelegramNotification(notificationDetails);

      if (purchaseResponse.status === "Sukses" || purchaseResponse.status === "Pending") {
        toast({
          title: `Order ${purchaseResponse.status}`,
          description: purchaseResponse.message || `Order untuk ${selectedProduct.product_name} ${purchaseResponse.status.toLowerCase()}. SN: ${purchaseResponse.sn || 'N/A'}`,
          duration: 7000,
        });
      } else { 
         toast({
          title: "Order Gagal",
          description: purchaseResponse.message || "Gagal memproses order Anda dengan Digiflazz.",
          variant: "destructive",
        });
      }

      setLastSubmittedOrder({
        refId: refId,
        productName: selectedProduct.product_name,
        meterNumber: meterNumber,
        plnCustomerName: meterInquiryResult.customerName,
        costPrice: selectedProduct.price,
        sellingPrice: clientSideSellingPriceEstimate, 
        profit: profitForSummary,
        status: purchaseResponse.status as TransactionStatus || "Gagal",
        message: purchaseResponse.message,
        sn: purchaseResponse.sn,
      });

      form.reset({ meterNumber: "" });
      setSelectedProduct(null);
      setMeterInquiryResult(null);
      setIsConfirmingOrder(false);
      setIsMeterChecked(false);
      setPinInput("");
      setPinError("");

    } catch (error) {
      console.error("Error verifikasi PIN atau submit order:", error);
      const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
      setPinError(`Error order: ${message}`);
      toast({ title: "Order Gagal", description: message, variant: "destructive" });

      const failedTxInput: NewTransactionInput = {
        id: refId,
        productName: selectedProduct.product_name,
        details: `${meterNumber} (${meterInquiryResult.customerName || 'N/A'})`,
        costPrice: selectedProduct.price,
        sellingPrice: 0,
        status: "Gagal",
        timestamp: new Date().toISOString(),
        failureReason: message,
        buyerSkuCode: selectedProduct.buyer_sku_code,
        originalCustomerNo: meterNumber,
        productCategoryFromProvider: selectedProduct.category,
        productBrandFromProvider: selectedProduct.brand,
        provider: 'digiflazz',
        transactedBy: authUser.username,
      };
      await addTransactionToDB(failedTxInput, authUser.username);
      const notificationDetails: TelegramNotificationDetails = {
        refId: refId,
        productName: selectedProduct.product_name,
        customerNoDisplay: `${meterNumber} (${meterInquiryResult.customerName || 'N/A'})`,
        status: "Gagal",
        provider: 'Digiflazz',
        costPrice: selectedProduct.price,
        sellingPrice: 0,
        failureReason: message,
        timestamp: new Date(),
        transactedBy: authUser.username,
      };
      trySendTelegramNotification(notificationDetails);
    } finally {
      setIsSubmittingWithPin(false);
    }
  };

  const hasActiveProductsAvailable = useMemo(() => {
    return availableProducts.some(p => p.buyer_product_status && p.seller_product_status);
  }, [availableProducts]);

  const handleRefreshPricelist = async () => {
    await loadAllApiProducts(true);
  };

  const ProductSkeleton = () => (
    <Card className="bg-card">
      <CardContent className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
      </CardContent>
    </Card>
  );

  if (isLoadingApiProducts && allApiProducts.length === 0 && !isRefreshingPricelist) {
    return (
      <OrderFormShell title="Beli Token Listrik PLN" description="Masukkan nomor meter untuk mencari produk." icon={Zap}>
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
          <p className="text-lg">Memuat produk Token Listrik dari Digiflazz...</p>
        </div>
      </OrderFormShell>
    );
  }

  if (apiProductsError && allApiProducts.length === 0 && !isLoadingApiProducts && !isRefreshingPricelist) {
    return (
      <OrderFormShell title="Beli Token Listrik PLN" description="Masukkan nomor meter untuk mencari produk." icon={Zap}>
        <Card className="text-center py-10 shadow border-destructive bg-destructive/10">
            <CardContent>
              <div className="text-destructive flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="h-6 w-6" /> <span className="font-semibold">Error Memuat Produk</span>
              </div>
              <p className="text-destructive/90">{apiProductsError}</p>
              <Button onClick={() => loadAllApiProducts(false)} className="mt-4">Coba Muat Ulang</Button>
            </CardContent>
          </Card>
      </OrderFormShell>
    );
  }

  return (
    <>
    {!lastSubmittedOrder ? (
      <OrderFormShell title="Beli Token Listrik PLN" description="Masukkan nomor meter, cek pelanggan, lalu pilih produk." icon={Zap}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitOrder)} className="space-y-6">
            <FormField
              control={form.control}
              name="meterNumber"
              render={({ field }) => (
                <FormItem>
                  <Label className="flex items-center">
                    <Zap className="mr-2 h-4 w-4 text-muted-foreground" />
                    Nomor Meter / ID Pelanggan
                  </Label>
                  <FormControl>
                    <Input
                      placeholder="e.g., 12345678901"
                      {...field}
                      type="tel"
                      disabled={isCheckingMeter || isRefreshingPricelist || isSubmittingWithPin}
                      maxLength={13}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  onClick={handleCheckMeterNumber}
                  className="w-full sm:flex-grow"
                  disabled={isCheckingMeter || !watchedMeterNumber || watchedMeterNumber.length < 10 || isRefreshingPricelist || (isLoadingApiProducts && allApiProducts.length === 0) || isSubmittingWithPin}
                >
                  {isCheckingMeter ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                      <Search className="mr-2 h-4 w-4" />
                  )}
                  {isCheckingMeter ? "Mengecek..." : "Cek ID Pelanggan"}
                </Button>
                <Button
                    type="button"
                    onClick={handleRefreshPricelist}
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={isRefreshingPricelist || (isLoadingApiProducts && allApiProducts.length === 0) || isSubmittingWithPin}
                >
                    {isRefreshingPricelist ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {isRefreshingPricelist ? 'Memuat Ulang...' : 'Refresh Pricelist'}
                </Button>
            </div>

            {isMeterChecked && (
              <>
                {meterCheckError && (!meterInquiryResult || !meterInquiryResult.isSuccess) && (
                  <div className="mt-2 text-sm text-destructive flex items-center gap-1.5 p-3 bg-destructive/10 rounded-md border border-destructive/30">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {meterCheckError}
                  </div>
                )}

                {meterInquiryResult?.isSuccess && meterInquiryResult.customerName && (
                  <div className="mt-2 p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-700">
                    <p className="font-semibold flex items-center"><UserCheck className="h-4 w-4 mr-2" />Data Pelanggan Ditemukan:</p>
                    <p><strong>Nama:</strong> {meterInquiryResult.customerName}</p>
                    {meterInquiryResult.meterNo && <p><strong>No. Meter:</strong> {meterInquiryResult.meterNo}</p>}
                    {meterInquiryResult.subscriberId && <p><strong>ID Pel:</strong> {meterInquiryResult.subscriberId}</p>}
                    {meterInquiryResult.segmentPower && <p><strong>Daya:</strong> {meterInquiryResult.segmentPower}</p>}
                  </div>
                )}
                
                {isLoadingApiProducts && isMeterChecked && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2 rounded-md border bg-muted/20">
                     {[...Array(6)].map((_, i) => <ProductSkeleton key={i} />)}
                  </div>
                )}
                
                {availableProducts.length > 0 && meterInquiryResult?.isSuccess && !isLoadingApiProducts && (
                  <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-semibold">Pilih Produk Token Listrik:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2 rounded-md border bg-muted/20">
                      {availableProducts.map(product => {
                        const isActive = product.buyer_product_status && product.seller_product_status;
                        return (
                            <Card
                              key={product.buyer_sku_code}
                              onClick={() => handleProductSelect(product)}
                              className={`bg-card transition-shadow
                                          ${isActive ? 'cursor-pointer hover:shadow-lg' : 'opacity-60 cursor-not-allowed'}
                                          ${selectedProduct?.buyer_sku_code === product.buyer_sku_code && isActive ? 'ring-2 ring-primary border-primary' : 'border-border'}`}
                            >
                              <CardContent className="p-3">
                                  <div className="flex justify-between items-start">
                                    <p className="font-medium text-sm flex-grow mr-2">{product.product_name}</p>
                                    {selectedProduct?.buyer_sku_code === product.buyer_sku_code && isActive && <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />}
                                  </div>
                                  <p className={`font-semibold text-md ${isActive ? 'text-primary': 'text-muted-foreground'}`}>Rp {product.price.toLocaleString()}</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                      <Badge variant="outline" className="text-xs">{product.brand}</Badge>
                                      {isActive ? (
                                        <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-300">Tersedia</Badge>
                                      ) : (
                                        <Badge variant="destructive" className="text-xs">Tidak Tersedia</Badge>
                                      )}
                                  </div>
                              </CardContent>
                            </Card>
                        );
                      })}
                    </div>
                     {selectedProduct && (
                        <div className="p-3 bg-primary/10 rounded-md mt-2 border border-primary/30 text-center">
                            <p className="font-semibold text-primary">Terpilih: {selectedProduct.product_name} (Modal: Rp {selectedProduct.price.toLocaleString()})</p>
                             {!(selectedProduct.buyer_product_status && selectedProduct.seller_product_status) && (
                                <p className="text-sm text-destructive">(Produk ini saat ini tidak tersedia)</p>
                            )}
                        </div>
                    )}
                  </div>
                )}
                {isMeterChecked && !meterCheckError && meterInquiryResult?.isSuccess && availableProducts.length === 0 && !isLoadingApiProducts && (
                  <div className="mt-4 text-center text-muted-foreground p-4 border rounded-md bg-card">
                    Tidak ada produk token listrik yang ditemukan untuk filter saat ini.
                  </div>
                )}
              </>
            )}

            {selectedProduct && isMeterChecked && meterInquiryResult?.isSuccess && hasActiveProductsAvailable && (
              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-6"
                disabled={isRefreshingPricelist || isSubmittingWithPin || !selectedProduct || !(selectedProduct.buyer_product_status && selectedProduct.seller_product_status) || !meterInquiryResult?.isSuccess}
              >
                <Send className="mr-2 h-4 w-4" /> Lanjut ke Pembayaran
              </Button>
            )}
          </form>
        </Form>
      </OrderFormShell>
    ) : (
      <Card className="mt-8 shadow-xl border-2 border-primary">
        <CardHeader className="bg-primary/10">
          <div className="flex items-center gap-3">
            {lastSubmittedOrder.status === "Sukses" ? <CheckCircle className="h-8 w-8 text-green-500" /> : lastSubmittedOrder.status === "Pending" ? <Clock className="h-8 w-8 text-yellow-500" /> : <AlertTriangle className="h-8 w-8 text-red-500" />}
            <CardTitle className="text-xl text-primary">
              {lastSubmittedOrder.status === "Sukses" ? "Transaction Successful" : lastSubmittedOrder.status === "Pending" ? "Transaction Pending" : "Transaction Failed"}
            </CardTitle>
          </div>
          <CardDescription className="text-primary/80">
            Ref ID: {lastSubmittedOrder.refId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <p><strong>Product:</strong> {lastSubmittedOrder.productName}</p>
          <p><strong>Meter Number:</strong> {lastSubmittedOrder.meterNumber} {lastSubmittedOrder.plnCustomerName && `(${lastSubmittedOrder.plnCustomerName})`}</p>
          <p><strong>Harga Jual (Estimasi):</strong> Rp {lastSubmittedOrder.sellingPrice.toLocaleString()}</p>
          {lastSubmittedOrder.status === "Sukses" && typeof lastSubmittedOrder.profit === 'number' && (
                <div className="flex items-center text-sm">
                    <DollarSign className="h-4 w-4 mr-1 text-green-600"/>
                    <span className="text-green-700 font-semibold">Profit (Estimasi): Rp {lastSubmittedOrder.profit.toLocaleString()}</span>
                </div>
            )}
          <div><strong>Status:</strong> <Badge variant={lastSubmittedOrder.status === 'Sukses' ? 'default' : lastSubmittedOrder.status === 'Gagal' ? 'destructive' : 'secondary'} className={`${lastSubmittedOrder.status === 'Sukses' ? 'bg-green-100 text-green-800 border-green-300' : lastSubmittedOrder.status === 'Gagal' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}>{lastSubmittedOrder.status}</Badge></div>
          {lastSubmittedOrder.message && <p className="text-sm text-muted-foreground"><strong>Message:</strong> {lastSubmittedOrder.message}</p>}
          {lastSubmittedOrder.sn && <p><strong>Token/SN:</strong> <span className="font-mono text-primary">{lastSubmittedOrder.sn}</span></p>}
          <p className="text-xs text-muted-foreground italic">Catatan: Harga Jual dan Profit yang ditampilkan di sini adalah estimasi. Nilai final tercatat di Riwayat Transaksi.</p>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={() => router.push('/transactions')} className="w-full sm:w-auto">
              <ListChecks className="mr-2 h-4 w-4" /> View Transaction History
            </Button>
            <Button onClick={() => setLastSubmittedOrder(null)} variant="outline" className="w-full sm:w-auto">
              <Tag className="mr-2 h-4 w-4" /> Place New Order
            </Button>
          </div>
        </CardContent>
      </Card>
    )}


      {isConfirmingOrder && selectedProduct && meterInquiryResult?.isSuccess && (
         <AlertDialog open={isConfirmingOrder} onOpenChange={(open) => { if (!open && !isSubmittingWithPin) setIsConfirmingOrder(false); else if (open) setIsConfirmingOrder(true); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                Konfirmasi Order Anda
              </AlertDialogTitle>
              <AlertDialogDescription className="pt-2 text-sm text-foreground">
                Harap periksa detail order Anda dan masukkan PIN untuk konfirmasi:
              </AlertDialogDescription>
              <div className="pt-2 space-y-1 text-sm text-foreground">
                <div><strong>Nomor Meter:</strong> {form.getValues("meterNumber")}</div>
                <div><strong>Nama Pelanggan:</strong> {meterInquiryResult.customerName}</div>
                {meterInquiryResult.segmentPower && <div><strong>Daya:</strong> {meterInquiryResult.segmentPower}</div>}
                <div><strong>Produk:</strong> {selectedProduct.product_name}</div>
                <div><strong>Harga Modal:</strong> Rp {selectedProduct.price.toLocaleString()}</div>
              </div>
            </AlertDialogHeader>

            <div className="space-y-2 py-4 bg-muted/70 rounded-lg p-4 my-4">
              <Label htmlFor="pinInputTokenListrik" className="flex items-center justify-center text-sm font-medium text-foreground/80">
                <KeyRound className="mr-2 h-4 w-4" />
                PIN Transaksi
              </Label>
              <Input
                id="pinInputTokenListrik"
                type="password"
                value={pinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 6) {
                    setPinInput(val);
                    if (pinError) setPinError("");
                  }
                }}
                placeholder="● ● ● ● ● ●"
                maxLength={6}
                className="text-center tracking-[0.5em] text-xl bg-background border-primary/50 focus:border-primary"
              />
              {pinError && <p className="text-sm text-destructive text-center pt-2">{pinError}</p>}
            </div>

            <AlertDialogFooter className="pt-2">
                <AlertDialogCancel onClick={() => {setIsConfirmingOrder(false); setPinInput(""); setPinError("");}} disabled={isSubmittingWithPin}>
                    Batal
                </AlertDialogCancel>
                <Button onClick={handlePinConfirm} disabled={isSubmittingWithPin || pinInput.length !== 6} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isSubmittingWithPin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Konfirmasi & Bayar
                </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
