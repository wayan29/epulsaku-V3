// src/app/(app)/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertTriangle, BarChart3, DollarSign, CalendarDays, CalendarRange, CalendarCheck2, CalendarSearch, Archive, CalendarClock, TrendingUp, CalendarIcon as CalendarIconLucide, Filter as FilterIcon, PieChart as PieChartIcon, Building } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Brush, PieChart, Pie, Cell, Legend } from 'recharts';
import { getTransactionsFromDB, type Transaction, type TransactionStatus } from '@/lib/transaction-utils';
import { 
  isSameDay, isSameWeek, isSameMonth, isSameYear, 
  parseISO, subDays, isValid, format as formatDateFns,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  differenceInDays, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  startOfDay, endOfDay, isWithinInterval
} from 'date-fns';
import type { DateRange } from "react-day-picker";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import ProtectedRoute from '@/components/core/ProtectedRoute';

interface PeriodStat {
  count: number;
  cost: number;
}

interface ChartDataPoint {
  date: string;
  count: number;
}

interface PieChartDataPoint {
  name: string;
  value: number;
  fill: string;
}

const PIE_CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#FF8042", "#FFBB28", "#00C49F"
];
const OTHERS_COLOR = "#A9A9A9"; // DarkGray for "Others" category

export default function DashboardPage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsErrorMsg, setTransactionsErrorMsg] = useState<string | null>(null);

  const [transactionStats, setTransactionStats] = useState<{
    daily: PeriodStat;
    yesterday: PeriodStat;
    weekly: PeriodStat;
    monthly: PeriodStat;
    yearly: PeriodStat;
    total: PeriodStat;
  } | null>(null);

  const [chartDateRange, setChartDateRange] = useState<DateRange | undefined>(undefined);
  const [activeChartFilterLabel, setActiveChartFilterLabel] = useState<string>("Last 7 Days");
  const [isLoadingChartData, setIsLoadingChartData] = useState(false);

  // New state for pie chart filter
  const [pieChartStatusFilter, setPieChartStatusFilter] = useState<TransactionStatus | "Semua">("Sukses");
  const [pieChartProviderFilter, setPieChartProviderFilter] = useState<"Semua" | "digiflazz" | "tokovoucher">("Semua");

  useEffect(() => {
    // Set default date range on client-side only to avoid hydration mismatch
    setChartDateRange({ 
      from: subDays(new Date(), 6), 
      to: new Date() 
    });
    
    async function loadInitialData() {
      setIsLoadingTransactions(true);
      setTransactionsErrorMsg(null);
      try {
        const dbTxs = await getTransactionsFromDB();
        setAllTransactions(dbTxs);
      } catch (err) {
        console.error("Failed to load transaction data:", err);
        const message = err instanceof Error ? err.message : "Could not load transaction data.";
        setTransactionsErrorMsg(message);
      } finally {
        setIsLoadingTransactions(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (allTransactions.length === 0 && !isLoadingTransactions) return;

    const now = new Date();
    const yesterdayDate = subDays(now, 1);

    const calculateStatsForPeriod = (filterFn: (txDate: Date) => boolean): PeriodStat => {
      const periodTxs = allTransactions.filter(tx => {
          const txDate = parseISO(tx.timestamp);
          return isValid(txDate) && filterFn(txDate);
      });
      const successfulPeriodTxs = periodTxs.filter(tx => tx.status === "Sukses" && typeof tx.costPrice === 'number');
      
      return {
        count: periodTxs.length,
        cost: successfulPeriodTxs.reduce((sum, tx) => sum + (tx.costPrice || 0) , 0)
      };
    };

    setTransactionStats({ 
      daily: calculateStatsForPeriod(txDate => isSameDay(txDate, now)), 
      yesterday: calculateStatsForPeriod(txDate => isSameDay(txDate, yesterdayDate)), 
      weekly: calculateStatsForPeriod(txDate => isSameWeek(txDate, now, { weekStartsOn: 1 })), 
      monthly: calculateStatsForPeriod(txDate => isSameMonth(txDate, now)), 
      yearly: calculateStatsForPeriod(txDate => isSameYear(txDate, now)), 
      total: calculateStatsForPeriod(() => true)
    });
  }, [allTransactions, isLoadingTransactions]);


  const transactionChartData = useMemo((): ChartDataPoint[] => {
    setIsLoadingChartData(true);
    if (allTransactions.length === 0) {
      setIsLoadingChartData(false);
      return [];
    }

    const transactionsToProcess = allTransactions.filter(tx => tx.status === "Sukses" && isValid(parseISO(tx.timestamp)));
    
    let range = chartDateRange;
    if (!range || !range.from) {
      // Default to last 7 days if range is not set yet
      range = { from: subDays(new Date(), 6), to: new Date() };
    }

    const from = startOfDay(range.from);
    const to = endOfDay(range.to || range.from);

    const daysDifference = differenceInDays(to, from);
    let dataPoints: ChartDataPoint[] = [];

    if (daysDifference <= 31) {
      const daysInInterval = eachDayOfInterval({ start: from, end: to });
      dataPoints = daysInInterval.map(day => ({
        date: formatDateFns(day, "dd MMM"),
        count: transactionsToProcess.filter(tx => isSameDay(parseISO(tx.timestamp), day)).length
      }));
    } else if (daysDifference <= 180) {
      const weeksInInterval = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
      dataPoints = weeksInInterval.map(weekStart => ({
        date: formatDateFns(weekStart, "dd MMM"),
        count: transactionsToProcess.filter(tx => isSameWeek(parseISO(tx.timestamp), weekStart, { weekStartsOn: 1 })).length
      }));
    } else { 
      const monthsInInterval = eachMonthOfInterval({ start: from, end: to });
      dataPoints = monthsInInterval.map(monthStart => ({
        date: formatDateFns(monthStart, "MMM yy"),
        count: transactionsToProcess.filter(tx => isSameMonth(parseISO(tx.timestamp), monthStart)).length
      }));
    }
    setIsLoadingChartData(false);
    return dataPoints;
  }, [allTransactions, chartDateRange]);


  const brandDistributionData = useMemo((): PieChartDataPoint[] => {
    let filteredTxs = allTransactions;
    
    // 1. Filter by date range first
    if (chartDateRange?.from) {
      const fromDate = startOfDay(chartDateRange.from);
      const toDate = chartDateRange.to ? endOfDay(chartDateRange.to) : endOfDay(new Date());

      if (isValid(fromDate) && isValid(toDate)) {
        filteredTxs = filteredTxs.filter(tx => {
            const txDate = parseISO(tx.timestamp);
            return isValid(txDate) && isWithinInterval(txDate, { start: fromDate, end: toDate });
        });
      }
    }

    // 2. Filter by status
    if (pieChartStatusFilter !== "Semua") {
      filteredTxs = filteredTxs.filter(tx => tx.status === pieChartStatusFilter);
    }
    
    // 3. Filter by provider
    if (pieChartProviderFilter !== "Semua") {
      filteredTxs = filteredTxs.filter(tx => tx.provider === pieChartProviderFilter);
    }

    if (filteredTxs.length === 0) return [];
    
    const brandCounts = filteredTxs.reduce((acc, tx) => {
      const brand = tx.productBrandFromProvider || 'Unknown';
      acc[brand] = (acc[brand] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    let sortedBrands = Object.entries(brandCounts).sort(([, a], [, b]) => b - a);

    let mainData: { name: string; value: number }[] = [];
    let othersCount = 0;

    sortedBrands.forEach((item, index) => {
        if(index < PIE_CHART_COLORS.length - 1) {
            mainData.push({ name: item[0], value: item[1] });
        } else {
            othersCount += item[1];
        }
    });

    if (othersCount > 0) {
      mainData.push({ name: 'Others', value: othersCount });
    }
    
    return mainData.map((item, index) => ({
      ...item,
      fill: item.name === 'Others' ? OTHERS_COLOR : PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]
    }));
  }, [allTransactions, pieChartStatusFilter, pieChartProviderFilter, chartDateRange]);


  const setChartDateFilter = (range: DateRange | undefined, label: string) => {
    setChartDateRange(range);
    setActiveChartFilterLabel(label);
  };

  const clearChartDateFilter = () => {
    setChartDateFilter({ from: subDays(new Date(), 6), to: new Date() }, "Last 7 Days");
  };

  const today = new Date();


  return (
    <ProtectedRoute requiredPermission='dashboard'>
      <div className="space-y-8">
        <div className="flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold font-headline">Dashboard Ringkasan</h1>
        </div>
        
        <section className="grid grid-cols-1 gap-6">
          <Card className="shadow-lg border-green-500/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold font-headline">Transaction Volume & Provider Costs</CardTitle>
                <BarChart3 className="h-6 w-6 text-green-500" />
            </CardHeader>
            <CardContent>
                {isLoadingTransactions && !transactionStats && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mr-3" /> <span>Loading statistics...</span>
                    </div>
                )}
                {transactionsErrorMsg && !isLoadingTransactions && (
                    <div className="text-destructive space-y-2 text-center py-6">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2" /> 
                        <p>Error: {transactionsErrorMsg}</p>
                    </div>
                )}
                {transactionStats && !isLoadingTransactions && !transactionsErrorMsg && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                        {[
                            { label: "Today", period: "daily", icon: CalendarDays, data: transactionStats.daily },
                            { label: "Yesterday", period: "yesterday", icon: CalendarClock, data: transactionStats.yesterday },
                            { label: "This Week", period: "weekly", icon: CalendarRange, data: transactionStats.weekly },
                            { label: "This Month", period: "monthly", icon: CalendarCheck2, data: transactionStats.monthly },
                            { label: "This Year", period: "yearly", icon: CalendarSearch, data: transactionStats.yearly },
                            { label: "Overall", period: "total", icon: Archive, data: transactionStats.total, highlight: true },
                        ].map(stat => (
                            <div key={stat.period} className={`p-4 rounded-lg ${stat.highlight ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/50'}`}>
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <stat.icon className={`h-4 w-4 ${stat.highlight ? 'text-green-600' : 'text-primary'}`} />
                                    {stat.label}
                                </div>
                                <div className="flex flex-col items-center justify-center mt-1 text-center">
                                  <p className={`text-2xl font-bold ${stat.highlight ? 'text-green-600' : 'text-foreground'}`}>{stat.data.count.toLocaleString()} Tx</p>
                                  <p className={`text-xs font-medium ${stat.highlight ? 'text-red-500' : 'text-red-600'}`}>
                                      Rp {stat.data.cost.toLocaleString()}
                                  </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 {transactionStats === null && !isLoadingTransactions && !transactionsErrorMsg && (
                    <p className="text-muted-foreground text-center py-6">Transaction statistics not available.</p>
                 )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold font-headline flex items-center gap-2">
                        <FilterIcon className="h-5 w-5 text-primary" />
                        Filter Chart Data ({activeChartFilterLabel})
                    </CardTitle>
                    <CardDescription>Filter ini berlaku untuk grafik "Transaction Count" dan "Brand Distribution" di bawah.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                        <div>
                        <Label htmlFor="chart-date-filter-popover" className="text-sm font-medium">Custom Date Range</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="chart-date-filter-popover"
                                variant={"outline"}
                                className={`w-full justify-start text-left font-normal mt-1 ${!chartDateRange?.from && "text-muted-foreground"}`}
                            >
                                <CalendarIconLucide className="mr-2 h-4 w-4" />
                                {chartDateRange?.from ? (
                                chartDateRange.to ? (
                                    <>
                                    {formatDateFns(chartDateRange.from, "LLL dd, y")} - {formatDateFns(chartDateRange.to, "LLL dd, y")}
                                    </>
                                ) : (
                                    formatDateFns(chartDateRange.from, "LLL dd, y")
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
                                defaultMonth={chartDateRange?.from}
                                selected={chartDateRange}
                                onSelect={(newRange) => setChartDateFilter(newRange, newRange?.from && newRange?.to ? `${formatDateFns(newRange.from, "dd/MM/yy")} - ${formatDateFns(newRange.to, "dd/MM/yy")}` : newRange?.from ? formatDateFns(newRange.from, "dd/MM/yy") : "Custom Range")}
                                numberOfMonths={2}
                            />
                            </PopoverContent>
                        </Popover>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:col-span-2 gap-2 pt-2 sm:pt-0">
                            <Button variant={activeChartFilterLabel === "Last 7 Days" ? "default" : "outline"} onClick={() => setChartDateFilter({ from: subDays(today, 6), to: today }, "Last 7 Days")} className="w-full">Last 7 Days</Button>
                            <Button variant={activeChartFilterLabel === "Last 30 Days" ? "default" : "outline"} onClick={() => setChartDateFilter({ from: subDays(today, 29), to: today }, "Last 30 Days")} className="w-full">Last 30 Days</Button>
                            <Button variant={activeChartFilterLabel === "This Month" ? "default" : "outline"} onClick={() => setChartDateFilter({ from: startOfMonth(today), to: endOfMonth(today) }, "This Month")} className="w-full">This Month</Button>
                            <Button variant={activeChartFilterLabel === "This Year" ? "default" : "outline"} onClick={() => setChartDateFilter({ from: startOfYear(today), to: endOfYear(today) }, "This Year")} className="w-full">This Year</Button>
                        </div>
                    </div>
                    { (chartDateRange && (chartDateRange.from?.getTime() !== startOfDay(subDays(today, 6)).getTime() || chartDateRange.to?.getTime() !== endOfDay(today).getTime())) && (
                        <Button onClick={clearChartDateFilter} variant="ghost" className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <FilterIcon className="mr-2 h-4 w-4" />
                        Reset Chart Filter (to Last 7 Days)
                        </Button>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="shadow-lg border-blue-500/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-semibold font-headline">Transaction Count ({activeChartFilterLabel})</CardTitle>
                        <TrendingUp className="h-6 w-6 text-blue-500" />
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isLoadingTransactions || isLoadingChartData ? (
                            <div className="flex items-center justify-center py-6 text-muted-foreground h-[350px]">
                                <Loader2 className="h-8 w-8 animate-spin mr-3" /> <span>Loading chart data...</span>
                            </div>
                        ) : transactionChartData.length > 0 ? (
                            <ChartContainer config={{}} className="h-[350px] w-full">
                                <AreaChart
                                    data={transactionChartData}
                                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="colorCountChart" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                                        axisLine={{ stroke: 'hsl(var(--border))' }}
                                        tickLine={{ stroke: 'hsl(var(--border))' }}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                        axisLine={{ stroke: 'hsl(var(--border))' }}
                                        tickLine={{ stroke: 'hsl(var(--border))' }}
                                        allowDecimals={false}
                                    />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent />}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="count" 
                                        stroke="hsl(var(--primary))" 
                                        fillOpacity={1} 
                                        fill="url(#colorCountChart)" 
                                        strokeWidth={2}
                                        dot={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, r:3, fill: 'hsl(var(--background))' }}
                                        activeDot={{ r: 5, stroke: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' }}
                                    />
                                    <Brush 
                                      dataKey="date" 
                                      height={30} 
                                      stroke="hsl(var(--primary))" 
                                      fill="hsl(var(--background))"
                                      tickFormatter={(value) => value.toString().substring(0, 3)}
                                      travellerWidth={10}
                                    />
                                </AreaChart>
                            </ChartContainer>
                        ) : (
                            <p className="text-muted-foreground text-center py-10 h-[350px] flex items-center justify-center">No transaction data available for the selected period to display on the chart.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-blue-500/50">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold font-headline flex items-center gap-2">
                            <PieChartIcon className="h-5 w-5 text-primary" />
                            Brand Transaction Distribution
                        </CardTitle>
                        <CardDescription>
                        Visualisasi jumlah transaksi per brand berdasarkan filter waktu, status, dan provider.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <div>
                            <Label className="text-sm font-medium">Filter by Status</Label>
                            <RadioGroup
                                defaultValue="Sukses"
                                value={pieChartStatusFilter}
                                onValueChange={(val) => setPieChartStatusFilter(val as any)}
                                className="flex items-center space-x-4 mt-2"
                                disabled={isLoadingTransactions}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Sukses" id="pie-sukses" />
                                    <Label htmlFor="pie-sukses">Success</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Gagal" id="pie-gagal" />
                                    <Label htmlFor="pie-gagal">Failed</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Semua" id="pie-semua" />
                                    <Label htmlFor="pie-semua">All</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div>
                            <Label className="text-sm font-medium">Filter by Provider</Label>
                            <RadioGroup
                                defaultValue="Semua"
                                value={pieChartProviderFilter}
                                onValueChange={(val) => setPieChartProviderFilter(val as any)}
                                className="flex items-center space-x-4 mt-2"
                                disabled={isLoadingTransactions}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Semua" id="pie-provider-semua" />
                                    <Label htmlFor="pie-provider-semua">All</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="digiflazz" id="pie-provider-digiflazz" />
                                    <Label htmlFor="pie-provider-digiflazz">Digiflazz</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="tokovoucher" id="pie-provider-tokovoucher" />
                                    <Label htmlFor="pie-provider-tokovoucher">TokoVoucher</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        </div>

                        {isLoadingTransactions ? (
                            <div className="flex items-center justify-center py-6 text-muted-foreground h-[350px]">
                                <Loader2 className="h-8 w-8 animate-spin mr-3" /> <span>Loading chart data...</span>
                            </div>
                        ) : brandDistributionData.length > 0 ? (
                            <ChartContainer config={{}} className="mx-auto aspect-square h-[350px]">
                            <PieChart>
                                <ChartTooltip 
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                                />
                                <Pie
                                    data={brandDistributionData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={60}
                                    labelLine={true}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {brandDistributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Legend />
                            </PieChart>
                            </ChartContainer>
                        ) : (
                            <p className="text-muted-foreground text-center py-10 h-[350px] flex items-center justify-center">No transaction data available for the selected filters to display on the chart.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}
