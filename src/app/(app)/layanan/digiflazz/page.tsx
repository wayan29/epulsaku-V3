// src/app/(app)/layanan/digiflazz/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ProductCard from "@/components/products/ProductCard";
import { Loader2, AlertTriangle, Smartphone, Zap, Gamepad2, Settings, PiggyBank, DollarSign, Wifi, RefreshCw, ShoppingBag, Ticket } from "lucide-react";
import type { LucideIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

import { fetchDigiflazzProducts, type DigiflazzProduct } from '@/ai/flows/fetch-digiflazz-products-flow';
import { fetchDigiflazzBalance } from '@/ai/flows/fetch-digiflazz-balance-flow';
import DigiflazzDepositDialog from '@/components/dashboard/DepositDialog';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';
import { Skeleton } from '@/components/ui/skeleton';
import ProtectedRoute from '@/components/core/ProtectedRoute';

export default function DigiflazzServicesPage() {
  const { toast } = useToast();
  const [digiflazzApiProducts, setDigiflazzApiProducts] = useState<DigiflazzProduct[]>([]);
  const [isLoadingApiProducts, setIsLoadingApiProducts] = useState(true);
  const [apiProductsError, setApiProductsError] = useState<string | null>(null);
  
  const [digiflazzBalance, setDigiflazzBalance] = useState<number | null>(null);
  const [isLoadingDigiflazzBalance, setIsLoadingDigiflazzBalance] = useState(true);
  const [digiflazzBalanceError, setDigiflazzBalanceError] = useState<string | null>(null);
  const [isDigiflazzDepositDialogOpen, setIsDigiflazzDepositDialogOpen] = useState(false);
  const digiflazzCredentialsMissingError = "Digiflazz username or API key is not configured in Admin Settings.";

  const loadDigiflazzBalance = async () => {
    setIsLoadingDigiflazzBalance(true);
    setDigiflazzBalanceError(null);
    try {
      const balanceData = await fetchDigiflazzBalance();
      setDigiflazzBalance(balanceData.balance);
    } catch (error) {
      console.error("Failed to load Digiflazz balance:", error);
      let errorMessage = error instanceof Error ? error.message : "Failed to load Digiflazz balance.";
      setDigiflazzBalanceError(errorMessage);
    } finally {
      setIsLoadingDigiflazzBalance(false);
    }
  };

  const loadApiProducts = async (isManualRefresh = false) => {
    if (isManualRefresh) {
        setIsLoadingApiProducts(true);
    }
    setApiProductsError(null);
    try {
      const productsData = await fetchDigiflazzProducts({ forceRefresh: isManualRefresh });
      setDigiflazzApiProducts(productsData);
      if (isManualRefresh) {
        toast({ title: "Product List Refreshed", description: "Successfully reloaded products from Digiflazz." });
      }
    } catch (error) {
      console.error("Failed to load Digiflazz API products for categories:", error);
      let errorMessage = "Failed to load product categories from API.";
      if (error instanceof Error) {
          errorMessage = error.message;
           if (errorMessage === digiflazzCredentialsMissingError) {
               errorMessage = "Digiflazz credentials not set. Cannot fetch products.";
           }
      }
      setApiProductsError(errorMessage);
      if (isManualRefresh || (!isLoadingApiProducts && !apiProductsError)) {
        toast({ title: "Error Loading Categories", description: errorMessage, variant: "destructive" });
      }
    } finally {
        if(isManualRefresh || isLoadingApiProducts) {
            setIsLoadingApiProducts(false);
        }
    }
  }

  useEffect(() => {
    async function checkConfigsAndLoadData() {
      const adminSettings = await getAdminSettingsFromDB();
      if (adminSettings.digiflazzUsername && adminSettings.digiflazzApiKey) {
        loadDigiflazzBalance();
        loadApiProducts();
      } else {
        setIsLoadingDigiflazzBalance(false);
        setDigiflazzBalanceError(digiflazzCredentialsMissingError);
        setIsLoadingApiProducts(false);
        setApiProductsError(digiflazzCredentialsMissingError);
        toast({ title: "Digiflazz Config Needed", description: digiflazzCredentialsMissingError, variant: "destructive", duration: 7000 });
      }
    }
    checkConfigsAndLoadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { prioritizedCategories, otherCategories } = useMemo(() => {
    if (isLoadingApiProducts || apiProductsError || digiflazzApiProducts.length === 0) {
      return { prioritizedCategories: [], otherCategories: [] };
    }

    const categoriesMap = new Map<string, { title: string; description: string; icon: LucideIcon; href: string; productCount: number; isPriority: boolean; products: DigiflazzProduct[] }>();

    digiflazzApiProducts.forEach(product => {
      let categoryKey: string | null = null;
      let displayTitle = product.category;
      let hrefLink = `/order/digital-services?category=${encodeURIComponent(product.category)}`;
      let icon = ShoppingBag;
      let description = `Layanan ${displayTitle} dari Digiflazz.`;
      let isPriority = false;

      const categoryUpper = product.category.toUpperCase();
      const brandUpper = product.brand.toUpperCase();

      if (brandUpper.includes("PLN") || categoryUpper.includes("TOKEN")) {
        categoryKey = "PLN";
        displayTitle = "PLN";
        hrefLink = "/order/token-listrik";
        icon = Zap;
        isPriority = true;
        description = "Beli token listrik PLN prabayar dengan mudah.";
      } else if (categoryUpper.includes("PULSA")) {
        categoryKey = "Pulsa";
        displayTitle = "Pulsa";
        hrefLink = "/order/pulsa";
        icon = Smartphone;
        isPriority = true;
        description = "Beli pulsa untuk semua operator dengan harga terbaik.";
      } else if (categoryUpper.includes("PAKET DATA") || categoryUpper.includes("DATA")) {
        categoryKey = "Paket Data";
        displayTitle = "Paket Data";
        hrefLink = `/order/digital-services?category=Paket%20Data`;
        icon = Wifi;
        isPriority = true;
        description = "Beli paket data internet untuk semua operator.";
      } else if (categoryUpper.includes("GAME") || brandUpper.includes("GAME") || categoryUpper.includes("TOPUP") || brandUpper.includes("VOUCHER GAME")) {
        categoryKey = "Top Up Games";
        displayTitle = "Top Up Games";
        hrefLink = `/order/digital-services?category=Games`;
        icon = Gamepad2;
        isPriority = true;
        description = "Top up diamond, UC, dan voucher game populer.";
      } else {
        categoryKey = product.category;
        const defaultIconMatch = Object.keys(productIconsMapping).find(key => displayTitle.toUpperCase().includes(key.toUpperCase()));
        icon = defaultIconMatch ? productIconsMapping[defaultIconMatch] : ShoppingBag;
      }

      if (!categoriesMap.has(categoryKey)) {
        categoriesMap.set(categoryKey, {
          title: displayTitle,
          description: description,
          icon: icon,
          href: hrefLink,
          productCount: 0,
          isPriority: isPriority,
          products: [],
        });
      }
      categoriesMap.get(categoryKey)!.products.push(product);
    });

    // Now, calculate the active product count for each category
    const allCats = Array.from(categoriesMap.values()).map(category => ({
      ...category,
      productCount: category.products.filter(p => p.buyer_product_status && p.seller_product_status).length,
    }));

    return {
      prioritizedCategories: allCats.filter(c => c.isPriority),
      otherCategories: allCats.filter(c => !c.isPriority).sort((a, b) => a.title.localeCompare(b.title)),
    };
  }, [digiflazzApiProducts, isLoadingApiProducts, apiProductsError]);

  const CategorySkeleton = () => (
    <div className="relative p-6 border rounded-xl shadow-md bg-card h-[180px] flex flex-col items-center justify-center text-center space-y-3">
        <Skeleton className="absolute top-2 right-2 h-6 w-12 rounded-full" />
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="space-y-2">
            <Skeleton className="h-5 w-24 mx-auto" />
            <Skeleton className="h-3 w-40 mx-auto" />
        </div>
    </div>
  );
  
  const allCategories = [...prioritizedCategories, ...otherCategories];

  return (
    <ProtectedRoute requiredPermission='layanan_digiflazz'>
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl sm:text-3xl font-bold font-headline">Layanan Produk Digiflazz</h1>
        <p className="text-md text-muted-foreground">Pilih kategori produk yang Anda butuhkan.</p>
      </section>

      <Card className="shadow-lg border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold font-headline">Saldo Digiflazz</CardTitle>
              <DollarSign className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent>
              {isLoadingDigiflazzBalance ? (
                  <Skeleton className="h-8 w-40" />
              ) : digiflazzBalanceError ? (
                  <div className="text-destructive space-y-1">
                      <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-5 w-5" /> <span>Error: {digiflazzBalanceError}</span>
                      </div>
                  </div>
              ) : digiflazzBalance !== null ? (
                  <p className="text-2xl font-bold text-primary"> Rp {digiflazzBalance.toLocaleString()} </p>
              ) : (
                  <p className="text-muted-foreground">Data saldo tidak tersedia.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={() => setIsDigiflazzDepositDialogOpen(true)} disabled={isLoadingDigiflazzBalance || !!digiflazzBalanceError}>
                    <PiggyBank className="mr-2 h-4 w-4" /> Request Deposit
                </Button>
                <Button onClick={() => loadApiProducts(true)} disabled={isLoadingApiProducts || !!apiProductsError} variant="secondary">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingApiProducts ? 'animate-spin' : ''}`} />
                  Refresh Kategori
                </Button>
              </div>
          </CardContent>
      </Card>


      {apiProductsError && !isLoadingApiProducts && (
        <Card className="text-center py-10 shadow border-destructive bg-destructive/10">
          <CardHeader>
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                  <AlertTriangle className="h-6 w-6" /> Error Loading Products
              </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive/90">{apiProductsError}</p>
            {apiProductsError.includes("Digiflazz credentials not set") && (
                <Button asChild variant="destructive" size="sm" className="mt-3">
                  <Link href="/admin-settings"> <Settings className="mr-2 h-4 w-4" /> Go to Admin Settings </Link>
                </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoadingApiProducts && (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Skeleton className="h-5 w-32" />
                  </h2>
                   <Skeleton className="h-4 w-20" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                 {[...Array(4)].map((_, i) => <CategorySkeleton key={i} />)}
              </div>
          </div>
      )}

      {!isLoadingApiProducts && !apiProductsError && allCategories.length > 0 && (
          <>
            {prioritizedCategories.length > 0 && (
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            Kategori Utama
                            <Separator className="w-16 h-0.5 bg-primary/50" />
                        </h2>
                        <span className="text-sm text-muted-foreground">{prioritizedCategories.length} kategori</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {prioritizedCategories.map((category) => (
                            <ProductCard
                                key={category.title}
                                title={category.title}
                                description={category.description}
                                icon={category.icon}
                                href={category.href}
                                productCount={category.productCount}
                            />
                        ))}
                    </div>
                </section>
            )}

             {otherCategories.length > 0 && (
                <section>
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            Kategori Lainnya
                             <Separator className="w-16 h-0.5 bg-primary/50" />
                        </h2>
                         <span className="text-sm text-muted-foreground">{otherCategories.length} kategori</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {otherCategories.map((category) => (
                            <ProductCard
                                key={category.title}
                                title={category.title}
                                description={category.description}
                                icon={category.icon}
                                href={category.href}
                                productCount={category.productCount}
                            />
                        ))}
                    </div>
                </section>
            )}
          </>
      )}

      {!isLoadingApiProducts && !apiProductsError && allCategories.length === 0 && (
           <p className="text-center text-muted-foreground py-10">No categories could be derived from active Digiflazz products.</p>
      )}

      <DigiflazzDepositDialog open={isDigiflazzDepositDialogOpen} onOpenChange={setIsDigiflazzDepositDialogOpen} onDepositSuccess={loadDigiflazzBalance} />
    </div>
    </ProtectedRoute>
  );
}

const productIconsMapping: { [key: string]: LucideIcon } = {
  Pulsa: Smartphone,
  "Token Listrik": Zap,
  "Game Topup": Gamepad2, 
  "Digital Service": ShoppingBag, 
  "FREE FIRE": Gamepad2,
  "MOBILE LEGENDS": Gamepad2,
  "GENSHIN IMPACT": Gamepad2,
  "HONKAI STAR RAIL": Gamepad2,
  "PLN": Zap,
  "E-Money": DollarSign, 
  "TV": Ticket,
  "PAKET DATA": Wifi,
  "VOUCHER": Ticket,
  "Default": ShoppingBag, 
};
