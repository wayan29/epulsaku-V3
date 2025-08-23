// src/app/(app)/tokovoucher-price-settings/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTokoVoucherCategories, type TokoVoucherCategory } from '@/ai/flows/tokovoucher/fetchTokoVoucherCategories-flow';
import { fetchTokoVoucherOperators, type TokoVoucherOperator } from '@/ai/flows/tokovoucher/fetchTokoVoucherOperators-flow';
import { fetchTokoVoucherProductTypes, type TokoVoucherProductType } from '@/ai/flows/tokovoucher/fetchTokoVoucherProductTypes-flow';
import { fetchTokoVoucherProducts, type TokoVoucherProduct } from '@/ai/flows/tokovoucher/fetchTokoVoucherProducts-flow';

import { fetchPriceSettingsFromDB, storePriceSettingsInDB, type PriceSettings as DbPriceSettings } from '@/lib/db-price-settings-utils';
import { savePriceSettings as savePriceSettingsToLocalStorage, type PriceSettings as LocalStoragePriceSettings } from '@/lib/price-settings-utils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, Save, AlertTriangle, RefreshCw, Filter, Lock, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from '@/components/core/ProtectedRoute';

const ALL_FILTER_VAL = "all_filter_val";
const PROVIDER_NAME = 'tokovoucher'; // Specific to this page

function getNamespacedProductIdentifier(productCode: string): string {
  return `${PROVIDER_NAME}::${productCode}`;
}

export default function TokoVoucherPriceSettingsPage() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [categories, setCategories] = useState<TokoVoucherCategory[]>([]);
  const [operators, setOperators] = useState<TokoVoucherOperator[]>([]);
  const [productTypes, setProductTypes] = useState<TokoVoucherProductType[]>([]);
  const [products, setProducts] = useState<TokoVoucherProduct[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(ALL_FILTER_VAL);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(ALL_FILTER_VAL);
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<string>(ALL_FILTER_VAL);

  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [isLoadingProductTypes, setIsLoadingProductTypes] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  const [customPrices, setCustomPrices] = useState<DbPriceSettings>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingInitialSettings, setIsLoadingInitialSettings] = useState(true);
  const [adminPasswordConfirmation, setAdminPasswordConfirmation] = useState("");
  const [overallError, setOverallError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    setIsLoadingCategories(true);
    setIsLoadingInitialSettings(true);
    setOverallError(null);
    try {
      const [categoriesResult, dbPriceSettings] = await Promise.all([
        fetchTokoVoucherCategories(),
        fetchPriceSettingsFromDB()
      ]);

      if (categoriesResult.isSuccess && categoriesResult.data) {
        setCategories(categoriesResult.data);
      } else {
        setOverallError(categoriesResult.message || "Failed to load TokoVoucher categories.");
        toast({ title: "Error Loading Categories", description: categoriesResult.message, variant: "destructive" });
      }
      setCustomPrices(dbPriceSettings); // dbPriceSettings already have namespaced keys
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error during initial load.";
      setOverallError(`Failed to load initial data: ${msg}`);
      toast({ title: "Error Loading Data", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingCategories(false);
      setIsLoadingInitialSettings(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedCategoryId === ALL_FILTER_VAL) {
      setOperators([]);
      setSelectedOperatorId(ALL_FILTER_VAL);
      return;
    }
    const loadOps = async () => {
      setIsLoadingOperators(true);
      setOverallError(null);
      const result = await fetchTokoVoucherOperators({ categoryId: parseInt(selectedCategoryId) });
      if (result.isSuccess && result.data) {
        setOperators(result.data);
      } else {
        setOperators([]);
        setOverallError(result.message || "Failed to load operators.");
        toast({ title: "Error Operators", description: result.message, variant: "destructive" });
      }
      setSelectedOperatorId(ALL_FILTER_VAL);
      setIsLoadingOperators(false);
    };
    loadOps();
  }, [selectedCategoryId, toast]);

  useEffect(() => {
    if (selectedOperatorId === ALL_FILTER_VAL) {
      setProductTypes([]);
      setSelectedProductTypeId(ALL_FILTER_VAL);
      return;
    }
    const loadTypes = async () => {
      setIsLoadingProductTypes(true);
      setOverallError(null);
      const result = await fetchTokoVoucherProductTypes({ operatorId: parseInt(selectedOperatorId) });
      if (result.isSuccess && result.data) {
        setProductTypes(result.data);
      } else {
        setProductTypes([]);
        setOverallError(result.message || "Failed to load product types.");
        toast({ title: "Error Product Types", description: result.message, variant: "destructive" });
      }
      setSelectedProductTypeId(ALL_FILTER_VAL);
      setIsLoadingProductTypes(false);
    };
    loadTypes();
  }, [selectedOperatorId, toast]);

  useEffect(() => {
    if (selectedProductTypeId === ALL_FILTER_VAL) {
      setProducts([]);
      return;
    }
    const loadProds = async () => {
      setIsLoadingProducts(true);
      setOverallError(null);
      const result = await fetchTokoVoucherProducts({ productTypeId: parseInt(selectedProductTypeId) });
      if (result.isSuccess && result.data) {
        setProducts(result.data.sort((a,b) => a.price - b.price));
      } else {
        setProducts([]);
        setOverallError(result.message || "Failed to load products.");
        toast({ title: "Error Products", description: result.message, variant: "destructive" });
      }
      setIsLoadingProducts(false);
    };
    loadProds();
  }, [selectedProductTypeId, toast]);

  const handlePriceChange = (productCode: string, newPrice: string) => {
    const priceNum = parseInt(newPrice, 10);
    const namespacedKey = getNamespacedProductIdentifier(productCode);
    setCustomPrices(prev => ({
      ...prev,
      [namespacedKey]: isNaN(priceNum) ? 0 : priceNum,
    }));
  };

  const handleClearCustomPrice = (productCode: string) => {
    const namespacedKey = getNamespacedProductIdentifier(productCode);
    setCustomPrices(prev => {
      const newPrices = { ...prev };
      delete newPrices[namespacedKey];
      return newPrices;
    });
    toast({
      title: "Custom Price Cleared",
      description: `Custom price for product code ${productCode} will revert to default markup upon saving.`,
    });
  };

  const handleSaveSettings = async () => {
    if (!authUser) {
      toast({ title: "Authentication Error", description: "Admin user not authenticated.", variant: "destructive" });
      return;
    }
    if (!adminPasswordConfirmation) {
      toast({ title: "Password Required", description: "Please enter your admin password.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    // customPrices already uses namespaced keys
    const settingsForDb: DbPriceSettings = {};
    for (const key in customPrices) {
        // Filter only TokoVoucher prices for this page and ensure price is positive
      if (key.startsWith(`${PROVIDER_NAME}::`) && customPrices[key] && customPrices[key] > 0) {
        settingsForDb[key] = customPrices[key];
      }
    }
    // Also include any non-TokoVoucher prices that were already in the DB
    const allDbSettings = await fetchPriceSettingsFromDB();
    for (const key in allDbSettings) {
        if (!key.startsWith(`${PROVIDER_NAME}::`)) {
            settingsForDb[key] = allDbSettings[key];
        }
    }

    const result = await storePriceSettingsInDB(settingsForDb, authUser.username, adminPasswordConfirmation);
    if (result.success) {
      toast({ title: "Settings Saved", description: "TokoVoucher price settings saved to database." });
      savePriceSettingsToLocalStorage(settingsForDb as LocalStoragePriceSettings);
      setAdminPasswordConfirmation("");
    } else {
      toast({ title: "Error Saving", description: result.message, variant: "destructive" });
    }
    setIsSaving(false);
  };

  const getDefaultMarkupPrice = (costPrice: number): number => {
    if (costPrice < 20000) return costPrice + 1000;
    if (costPrice <= 50000) return costPrice + 1500;
    return costPrice + 2000;
  };

  const handleRefreshData = () => {
    // This logic is simplified to re-trigger the useEffects by resetting selections
    // or reload all if no specific filter is active
    if (selectedProductTypeId !== ALL_FILTER_VAL) {
        const currentSelection = selectedProductTypeId;
        setSelectedProductTypeId(ALL_FILTER_VAL); // Trigger reload of products
        setTimeout(() => setSelectedProductTypeId(currentSelection), 0);
        toast({title: "Data Refreshed", description: "Product list for current selection updated."})
    } else if (selectedOperatorId !== ALL_FILTER_VAL) {
        const currentSelection = selectedOperatorId;
        setSelectedOperatorId(ALL_FILTER_VAL); // Trigger reload of types
        setTimeout(() => setSelectedOperatorId(currentSelection), 0);
        toast({title: "Data Refreshed", description: "Product types for current operator updated."})
    } else if (selectedCategoryId !== ALL_FILTER_VAL) {
        const currentSelection = selectedCategoryId;
        setSelectedCategoryId(ALL_FILTER_VAL); // Trigger reload of operators
        setTimeout(() => setSelectedCategoryId(currentSelection), 0);
        toast({title: "Data Refreshed", description: "Operators for current category updated."})
    } else {
        loadInitialData();
        toast({title: "Data Refreshed", description: "Categories and price settings reloaded."})
    }
  };

  if (isLoadingInitialSettings && isLoadingCategories) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
        <p className="text-lg">Loading TokoVoucher data and price settings...</p>
      </div>
    );
  }
  
  if (overallError && categories.length === 0) {
     return (
      <Card className="text-center py-10 shadow border-destructive bg-destructive/10">
        <CardHeader><CardTitle className="text-destructive flex items-center justify-center gap-2"><AlertTriangle className="h-6 w-6" /> Error Loading Data</CardTitle></CardHeader>
        <CardContent><p className="text-destructive/90">{overallError}</p><Button onClick={loadInitialData} className="mt-4">Try Reload</Button></CardContent>
      </Card>
    );
  }

  return (
    <ProtectedRoute requiredPermission='pengaturan_harga_tokovoucher'>
    <div className="space-y-8">
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-7 w-7 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold font-headline">TokoVoucher Price Settings</h1>
        </div>
         <Button onClick={handleRefreshData} disabled={isSaving || isLoadingCategories || isLoadingOperators || isLoadingProductTypes || isLoadingProducts} variant="outline" className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Current Data
        </Button>
      </section>
      <CardDescription>
        Set custom selling prices for TokoVoucher products. Select Category, Operator, then Product Type to view and set prices.
        Changes require admin password confirmation.
      </CardDescription>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-headline">
            <Filter className="h-5 w-5 text-primary" />
            Select Product Group
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="tv-category-filter">Category</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} disabled={isLoadingCategories || isSaving}>
              <SelectTrigger id="tv-category-filter"><SelectValue placeholder="Select Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VAL}>All Categories</SelectItem>
                {categories.map(cat => <SelectItem key={cat.id} value={String(cat.id)}>{cat.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            {isLoadingCategories && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
          </div>
          <div>
            <Label htmlFor="tv-operator-filter">Operator</Label>
            <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId} disabled={selectedCategoryId === ALL_FILTER_VAL || isLoadingOperators || isSaving}>
              <SelectTrigger id="tv-operator-filter"><SelectValue placeholder={selectedCategoryId === ALL_FILTER_VAL ? "Select Category First" : "Select Operator"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VAL}>All Operators</SelectItem>
                {operators.map(op => <SelectItem key={op.id} value={String(op.id)}>{op.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            {isLoadingOperators && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
          </div>
          <div>
            <Label htmlFor="tv-product-type-filter">Product Type</Label>
            <Select value={selectedProductTypeId} onValueChange={setSelectedProductTypeId} disabled={selectedOperatorId === ALL_FILTER_VAL || isLoadingProductTypes || isSaving}>
              <SelectTrigger id="tv-product-type-filter"><SelectValue placeholder={selectedOperatorId === ALL_FILTER_VAL ? "Select Operator First" : "Select Product Type"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VAL}>All Product Types</SelectItem>
                {productTypes.map(pt => <SelectItem key={pt.id} value={String(pt.id)}>{pt.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            {isLoadingProductTypes && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
          </div>
        </CardContent>
      </Card>

      {selectedProductTypeId !== ALL_FILTER_VAL && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Products for {products[0]?.category_name || categories.find(c=>String(c.id)===selectedCategoryId)?.nama} &gt; {products[0]?.op_name || operators.find(o=>String(o.id)===selectedOperatorId)?.nama} &gt; {products[0]?.jenis_name || productTypes.find(pt=>String(pt.id)===selectedProductTypeId)?.nama}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingProducts && <div className="flex justify-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading products...</span></div>}
            {!isLoadingProducts && products.length === 0 && <p className="text-muted-foreground text-center py-4">No products found for this selection.</p>}
            {!isLoadingProducts && overallError && products.length === 0 && <p className="text-destructive text-center py-4">{overallError}</p>}
            {!isLoadingProducts && products.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Product Name</TableHead>
                      <TableHead className="min-w-[100px]">Code</TableHead>
                      <TableHead className="text-right min-w-[120px]">Cost Price</TableHead>
                      <TableHead className="text-right min-w-[180px]">Custom Selling Price</TableHead>
                      <TableHead className="text-right min-w-[120px]">Est. Profit</TableHead>
                      <TableHead className="text-center min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const costPrice = product.price;
                      const namespacedKey = getNamespacedProductIdentifier(product.code);
                      const customSellingPrice = customPrices[namespacedKey];
                      const effectiveSellingPrice = (customSellingPrice && customSellingPrice > 0) ? customSellingPrice : getDefaultMarkupPrice(costPrice);
                      const profit = effectiveSellingPrice - costPrice;
                      const isInactive = product.status !== 1;

                      return (
                        <TableRow key={product.code} className={isInactive ? 'opacity-50 bg-muted/30' : ''}>
                          <TableCell className="font-medium">
                            {product.nama_produk}
                            {isInactive && <span className="text-xs text-red-500 ml-1">(Inactive)</span>}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{product.code}</TableCell>
                          <TableCell className="text-right">Rp {costPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              placeholder={`Default: Rp ${getDefaultMarkupPrice(costPrice).toLocaleString()}`}
                              value={customPrices[namespacedKey] || ''}
                              onChange={(e) => handlePriceChange(product.code, e.target.value)}
                              className="min-w-[150px] text-right h-9"
                              disabled={isSaving || isLoadingProducts}
                            />
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${profit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Rp {profit.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" onClick={() => handleClearCustomPrice(product.code)}
                              disabled={isSaving || isLoadingProducts || typeof customPrices[namespacedKey] === 'undefined'}
                              className="text-xs text-muted-foreground hover:text-destructive"
                              title="Clear custom price & use default markup">
                              Clear
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {products.length > 0 && selectedProductTypeId !== ALL_FILTER_VAL && (
        <Card className="mt-6 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg font-medium text-destructive flex items-center gap-2"><Lock className="h-5 w-5" />Confirm Changes</CardTitle>
                <CardDescription>Enter your admin password to save all TokoVoucher price settings to the database. This will preserve existing settings for other providers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="tv-admin-password">Admin Password</Label>
                    <Input id="tv-admin-password" type="password" value={adminPasswordConfirmation}
                        onChange={(e) => setAdminPasswordConfirmation(e.target.value)}
                        placeholder="Enter admin password"
                        className="mt-1 border-destructive focus:border-destructive"
                        disabled={isSaving || isLoadingProducts}
                    />
                </div>
                <Button onClick={handleSaveSettings} disabled={isSaving || isLoadingProducts || !adminPasswordConfirmation} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save TokoVoucher Prices
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
    </ProtectedRoute>
  );
}
