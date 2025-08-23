// src/app/(app)/transactions/page.tsx
"use client"; 

import TransactionItem, { Transaction, TransactionStatus } from "@/components/transactions/TransactionItem";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { RefreshCw, Loader2, CalendarIcon, ListFilter, FilterX, Building, ChevronLeft, ChevronRight, Filter, AlertTriangle } from "lucide-react"; 
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay, isValid } from "date-fns";
import { getTransactionsFromDB, updateTransactionInDB, getTransactionByIdFromDB } from "@/lib/transaction-utils";
import { purchaseDigiflazzProduct } from "@/ai/flows/purchase-digiflazz-product-flow";
import { checkTokoVoucherTransactionStatus } from "@/ai/flows/tokovoucher/checkTokoVoucherTransactionStatus-flow";
import { trySendTelegramNotification, type TelegramNotificationDetails } from '@/lib/notification-utils';
import { useToast } from "@/hooks/use-toast";
import ProtectedRoute from '@/components/core/ProtectedRoute';

const ALL_CATEGORIES = "all_categories";
const ALL_STATUSES = "all_statuses";
const ALL_PROVIDERS = "all_providers";

type ProviderFilter = "all_providers" | "digiflazz" | "tokovoucher";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = ITEMS_PER_PAGE_OPTIONS[0];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
  const [selectedStatus, setSelectedStatus] = useState<string>(ALL_STATUSES);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedProvider, setSelectedProvider] = useState<ProviderFilter>(ALL_PROVIDERS);
  
  const [itemsPerPage, setItemsPerPage] = useState<number>(DEFAULT_ITEMS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const intervalRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const dbTxs = await getTransactionsFromDB();
        setTransactions(dbTxs);
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Could not load transactions.";
        console.error("Error loading transactions from DB:", error);
        setError(msg);
        toast({ title: "Error", description: msg, variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);


  const autoCheckTransactionStatus = useCallback(async (tx: Transaction) => {
      if (tx.status !== 'Pending') return;
      try {
        console.log(`Auto-checking status for pending transaction ID: ${tx.id}`);
        let newStatus: TransactionStatus | undefined;
        let snFromProvider: string | null | undefined = null;
        let messageFromProvider: string | null | undefined = null;
        let trxIdFromProvider: string | null | undefined = null;
        let priceFromProvider: number | null | undefined = null;

        if (tx.provider === 'tokovoucher') {
            const tokovoucherStatusResult = await checkTokoVoucherTransactionStatus({ ref_id: tx.id });
            if (tokovoucherStatusResult.isSuccess) {
                newStatus = tokovoucherStatusResult.status?.toLowerCase() === 'sukses' ? 'Sukses' :
                            tokovoucherStatusResult.status?.toLowerCase() === 'pending' ? 'Pending' : 'Gagal';
                snFromProvider = tokovoucherStatusResult.sn;
                messageFromProvider = tokovoucherStatusResult.message;
                trxIdFromProvider = tokovoucherStatusResult.trx_id;
                priceFromProvider = tokovoucherStatusResult.price;
            } else {
                console.warn(`TokoVoucher status check API call failed for ${tx.id}: ${tokovoucherStatusResult.error_msg}`);
                return; // Don't update if API call itself fails
            }
        } else { 
            const digiflazzResult = await purchaseDigiflazzProduct({
                buyerSkuCode: tx.buyerSkuCode,
                customerNo: tx.originalCustomerNo,
                refId: tx.id,
            });
            newStatus = digiflazzResult.status as TransactionStatus | undefined;
            snFromProvider = digiflazzResult.sn;
            messageFromProvider = digiflazzResult.message;
            priceFromProvider = digiflazzResult.price;
        }

        const currentTxState = await getTransactionByIdFromDB(tx.id);
        if (!currentTxState || currentTxState.status !== "Pending") {
          console.log(`Auto-check for ${tx.id}: Transaction no longer pending in DB. Halting interval.`);
          const intervalId = intervalRefs.current.get(tx.id);
          if (intervalId) {
            clearInterval(intervalId);
            intervalRefs.current.delete(tx.id);
          }
          return;
        }

        if (newStatus && newStatus !== "Pending") {
            const updateResult = await updateTransactionInDB({ 
                id: tx.id,
                status: newStatus,
                serialNumber: snFromProvider || undefined,
                failureReason: newStatus === "Gagal" ? (messageFromProvider || (tx.provider === 'tokovoucher' && snFromProvider)) : undefined,
                providerTransactionId: trxIdFromProvider || undefined,
                costPrice: priceFromProvider ?? undefined, 
            });

          if (updateResult.success) {
            const freshTx = await getTransactionByIdFromDB(tx.id);
            if (freshTx) {
                trySendTelegramNotification({
                    refId: freshTx.id,
                    productName: freshTx.productName,
                    customerNoDisplay: freshTx.details,
                    status: newStatus,
                    provider: freshTx.provider,
                    costPrice: priceFromProvider ?? freshTx.costPrice,
                    sellingPrice: freshTx.sellingPrice,
                    profit: newStatus === "Sukses" ? freshTx.sellingPrice - (priceFromProvider ?? freshTx.costPrice) : undefined,
                    sn: snFromProvider || null,
                    failureReason: newStatus === "Gagal" ? (messageFromProvider || (tx.provider === 'tokovoucher' && snFromProvider)) : null,
                    timestamp: new Date(), 
                    additionalInfo: "Auto Update",
                    trxId: trxIdFromProvider || freshTx.providerTransactionId,
                    transactedBy: freshTx.transactedBy,
                });
            }
            toast({
                title: "Auto Status Update",
                description: `Transaction ${tx.productName} (ID: ...${tx.id.slice(-6)}) changed to ${newStatus}. ${messageFromProvider || ""}`,
            });
            loadTransactions(); 
          }
        }
      } catch (error) {
        console.error(`Error auto-checking status for transaction ID ${tx.id}:`, error);
      }
    }, [loadTransactions, toast]);

    useEffect(() => {
        const pendingTransactions = transactions.filter(tx => tx.status === 'Pending');
        const currentIntervals = intervalRefs.current;
    
        // Clear intervals for transactions that are no longer pending or not in the current list
        currentIntervals.forEach((intervalId, txId) => {
            if (!pendingTransactions.some(tx => tx.id === txId)) {
                clearInterval(intervalId);
                currentIntervals.delete(txId);
            }
        });
    
        // Set up intervals for new pending transactions
        pendingTransactions.forEach(tx => {
            if (!currentIntervals.has(tx.id)) {
                const intervalId = setInterval(() => autoCheckTransactionStatus(tx), 60000); // 60 seconds
                currentIntervals.set(tx.id, intervalId);
            }
        });
    
        // Cleanup on component unmount
        return () => {
            currentIntervals.forEach(intervalId => clearInterval(intervalId));
            currentIntervals.clear();
        };
    }, [transactions, autoCheckTransactionStatus]);

  const availableCategories = useMemo(() => {
    const categories = new Set(transactions.map(tx => tx.categoryKey).filter(Boolean));
    return [ALL_CATEGORIES, ...Array.from(categories).sort()];
  }, [transactions]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set(transactions.map(tx => tx.status));
    const statusOptions = Array.from(statuses).sort().map(s => ({ label: s, value: s }));
    return [{ label: "All Statuses", value: ALL_STATUSES }, ...statusOptions];
  }, [transactions]);

  const availableProviders: { label: string; value: ProviderFilter }[] = [
    { label: "All Providers", value: ALL_PROVIDERS },
    { label: "Digiflazz", value: "digiflazz" },
    { label: "TokoVoucher", value: "tokovoucher" },
  ];

  const filteredTransactions = useMemo(() => { 
    return transactions.filter(tx => {
      const categoryMatch = selectedCategory === ALL_CATEGORIES || tx.categoryKey === selectedCategory;
      const statusMatch = selectedStatus === ALL_STATUSES || tx.status === selectedStatus;
      const providerMatch = selectedProvider === ALL_PROVIDERS || tx.provider === selectedProvider;
      
      let dateMatch = true;
      if (dateRange?.from) { 
        const txDate = new Date(tx.timestamp);
        if (isValid(txDate)) {
          const effectiveToDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date()); 
          const effectiveFromDate = startOfDay(dateRange.from);
          dateMatch = isWithinInterval(txDate, { start: effectiveFromDate, end: effectiveToDate });
        } else {
          dateMatch = false; 
        }
      }
      return categoryMatch && statusMatch && dateMatch && providerMatch;
    });
  }, [transactions, selectedCategory, selectedStatus, dateRange, selectedProvider]);

  const { paginatedTransactions, totalPages } = useMemo(() => {
    const total = Math.ceil(filteredTransactions.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = currentPage * itemsPerPage;
    return {
        paginatedTransactions: filteredTransactions.slice(start, end),
        totalPages: total > 0 ? total : 1, 
    };
  }, [filteredTransactions, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) { 
        setCurrentPage(totalPages);
    } else if (currentPage === 0 && totalPages > 0) {
        setCurrentPage(1);
    } else if (totalPages === 1 && currentPage !==1){ 
        setCurrentPage(1);
    }
  }, [totalPages, currentPage]);


  const handleRefresh = () => {
    loadTransactions();
  }

  const resetFilters = () => {
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedStatus(ALL_STATUSES);
    setDateRange(undefined);
    setSelectedProvider(ALL_PROVIDERS);
    setItemsPerPage(DEFAULT_ITEMS_PER_PAGE);
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedCategory !== ALL_CATEGORIES || 
                           selectedStatus !== ALL_STATUSES || 
                           dateRange !== undefined || 
                           selectedProvider !== ALL_PROVIDERS ||
                           itemsPerPage !== DEFAULT_ITEMS_PER_PAGE;

  const activeFilterCount = [
    selectedCategory !== ALL_CATEGORIES,
    selectedStatus !== ALL_STATUSES,
    dateRange !== undefined,
    selectedProvider !== ALL_PROVIDERS,
  ].filter(Boolean).length;


  return (
    <ProtectedRoute requiredPermission='riwayat_transaksi'>
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline">Transaction History</h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full">
                        {activeFilterCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                    <ListFilter className="h-5 w-5 text-primary"/>
                    Filter Transactions
                </SheetTitle>
                <SheetDescription>
                    Refine your transaction list based on category, status, provider, or date.
                </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-4">
                    <div>
                    <Label htmlFor="category-filter-sheet" className="text-sm font-medium">Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger id="category-filter-sheet">
                        <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                        {availableCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>
                            {cat === ALL_CATEGORIES ? "All Categories" : cat}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>

                    <div>
                    <Label htmlFor="status-filter-sheet" className="text-sm font-medium">Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger id="status-filter-sheet">
                        <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                        {availableStatuses.map(stat => (
                            <SelectItem key={stat.value} value={stat.value}>
                            {stat.label}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>

                    <div>
                    <Label htmlFor="provider-filter-sheet" className="text-sm font-medium">Provider</Label>
                    <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as ProviderFilter)}>
                        <SelectTrigger id="provider-filter-sheet">
                        <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Select Provider" />
                        </div>
                        </SelectTrigger>
                        <SelectContent>
                        {availableProviders.map(prov => (
                            <SelectItem key={prov.value} value={prov.value}>
                            {prov.label}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                    
                    <div>
                    <Label htmlFor="date-filter-popover-sheet" className="text-sm font-medium">Date Range</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date-filter-popover-sheet"
                            variant={"outline"}
                            className={`w-full justify-start text-left font-normal ${!dateRange?.from && "text-muted-foreground"}`}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Pick a date range</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={1} 
                        />
                        </PopoverContent>
                    </Popover>
                    </div>

                    <div>
                    <Label htmlFor="items-per-page-filter-sheet" className="text-sm font-medium">Show</Label>
                    <Select 
                        value={String(itemsPerPage)} 
                        onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1); 
                        }}
                    >
                        <SelectTrigger id="items-per-page-filter-sheet">
                        <SelectValue placeholder="Items per page" />
                        </SelectTrigger>
                        <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map(option => (
                            <SelectItem key={option} value={String(option)}>
                            {option} per page
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                </div>
                <SheetFooter className="mt-auto pt-4 border-t">
                    <SheetClose asChild>
                        <Button variant="outline" className="w-full">Close</Button>
                    </SheetClose>
                    {hasActiveFilters && (
                        <Button onClick={resetFilters} variant="destructive" className="w-full">
                        <FilterX className="mr-2 h-4 w-4" />
                        Reset All Filters
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
            </Sheet>
            <Button onClick={handleRefresh} variant="outline" disabled={isLoading} className="w-full sm:w-auto flex-shrink-0">
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
        </div>
      </div>


      {isLoading && transactions.length === 0 ? ( 
        <div className="text-center py-10 text-muted-foreground">
          <Loader2 className="mx-auto h-10 w-10 animate-spin mb-4" />
          <p>Loading transactions...</p>
        </div>
      ) : error ? (
        <Card className="text-center py-10 shadow border-destructive bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                  <AlertTriangle className="h-6 w-6" /> Error Loading Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive/90">{error}</p>
              <Button onClick={handleRefresh} className="mt-4" variant="outline">Try Again</Button>
            </CardContent>
        </Card>
      ) : !isLoading && filteredTransactions.length === 0 ? ( 
        <div className="text-center py-10">
          <p className="text-lg text-muted-foreground">
            {hasActiveFilters ? "No transactions match your filters." : "You have no transactions yet."}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {hasActiveFilters ? "Try adjusting your filters or reset them." : "Try making a purchase to see it here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedTransactions.map((transaction) => (
            <TransactionItem 
              key={transaction.id} 
              transaction={transaction} 
              onTransactionUpdate={loadTransactions} 
            />
          ))}
        </div>
      )}
      
      {!isLoading && filteredTransactions.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
