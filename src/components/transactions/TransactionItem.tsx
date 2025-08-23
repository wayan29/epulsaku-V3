// src/components/transactions/TransactionItem.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Smartphone,
  Zap,
  Gamepad2,
  DollarSign,
  Ticket,
  LucideIcon,
  LucideAlertCircle,
  CalendarDays,
  Info,
  ShoppingBag,
  CreditCard,
  Hash,
  RefreshCw,
  Code2,
  UserSquare2,
  Trash2,
  AlertTriangle,
  Copy,
  Server,
  Building,
  Bot,
  Briefcase,
  FileText,
  UserCircle,
} from "lucide-react";
import { purchaseDigiflazzProduct } from "@/ai/flows/purchase-digiflazz-product-flow";
import { checkTokoVoucherTransactionStatus } from "@/ai/flows/tokovoucher/checkTokoVoucherTransactionStatus-flow";
import { useToast } from "@/hooks/use-toast";
import {
  updateTransactionInDB,
  deleteTransactionFromDB,
  getTransactionByIdFromDB,
} from "@/lib/transaction-utils";
import { trySendTelegramNotification } from "@/lib/notification-utils";
import { getEffectiveSellingPrice } from "@/lib/price-settings-utils";

export const productIconsMapping: { [key: string]: LucideIcon } = {
  Pulsa: Smartphone,
  "Token Listrik": Zap,
  "Game Topup": Gamepad2,
  "Digital Service": ShoppingBag,
  "FREE FIRE": Gamepad2,
  "MOBILE LEGENDS": Gamepad2,
  "GENSHIN IMPACT": Gamepad2,
  "HONKAI STAR RAIL": Gamepad2,
  PLN: Zap,
  "E-Money": CreditCard,
  Default: ShoppingBag,
};

export const productCategoryColors: {
  [key: string]: {
    light: string;
    dark: string;
    gradient: string;
    icon: string;
    cssClass: string;
  };
} = {
  Pulsa: {
    light: "bg-blue-50 text-blue-800 border-blue-200",
    dark: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50",
    gradient: "from-blue-500 to-sky-400",
    icon: "text-blue-500 dark:text-blue-400",
    cssClass: "category-pulsa",
  },
  "Token Listrik": {
    light: "bg-yellow-50 text-yellow-800 border-yellow-200",
    dark: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700/50",
    gradient: "from-yellow-500 to-amber-400",
    icon: "text-yellow-500 dark:text-yellow-400",
    cssClass: "category-token",
  },
  Game: {
    light: "bg-purple-50 text-purple-800 border-purple-200",
    dark: "dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/50",
    gradient: "from-purple-500 to-indigo-400",
    icon: "text-purple-500 dark:text-purple-400",
    cssClass: "category-game",
  },
  "E-Money": {
    light: "bg-green-50 text-green-800 border-green-200",
    dark: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50",
    gradient: "from-green-500 to-emerald-400",
    icon: "text-green-500 dark:text-green-400",
    cssClass: "category-emoney",
  },
  Default: {
    light: "bg-gray-50 text-gray-800 border-gray-200",
    dark: "dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700/50",
    gradient: "from-gray-500 to-gray-400",
    icon: "text-gray-500 dark:text-gray-400",
    cssClass: "category-default",
  },
};

export type TransactionStatus = "Sukses" | "Pending" | "Gagal";

export interface TransactionCore {
  id: string;
  productName: string;
  details: string;
  costPrice: number;
  sellingPrice: number;
  status: TransactionStatus;
  timestamp: string;
  serialNumber?: string;
  failureReason?: string;
  buyerSkuCode: string;
  originalCustomerNo: string;
  productCategoryFromProvider: string;
  productBrandFromProvider: string;
  provider: "digiflazz" | "tokovoucher";
  source?: "web" | "telegram_bot";
  providerTransactionId?: string;
  transactionYear?: number;
  transactionMonth?: number;
  transactionDayOfMonth?: number;
  transactionDayOfWeek?: number;
  transactionHour?: number;
  transactedBy?: string;
}

export interface Transaction extends TransactionCore {
  iconName: string;
  categoryKey: string;
  _id?: string;
}

export interface NewTransactionInput extends TransactionCore {}

const statusConfig: {
  [key in TransactionStatus]: {
    icon: LucideIcon;
    color: string;
    textColor: string;
    displayText: string;
  };
} = {
  Sukses: {
    icon: CheckCircle2,
    color: "bg-green-500 hover:bg-green-500",
    textColor: "text-green-700",
    displayText: "Success",
  },
  Pending: {
    icon: Loader2,
    color: "bg-yellow-500 hover:bg-yellow-500",
    textColor: "text-yellow-700",
    displayText: "Pending",
  },
  Gagal: {
    icon: XCircle,
    color: "bg-red-500 hover:bg-red-500",
    textColor: "text-red-700",
    displayText: "Failed",
  },
};

interface TransactionItemProps {
  transaction: Transaction;
  onTransactionUpdate: () => void;
}

interface DetailRowProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  isMono?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({
  icon: Icon,
  label,
  value,
  valueClassName,
  isMono,
}) => (
  <div className="grid grid-cols-[max-content_1fr] items-start gap-x-3 py-1.5">
    <div className="flex items-center text-muted-foreground">
      <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
      <span className="font-medium text-xs sm:text-sm">{label}:</span>
    </div>
    <div
      className={`text-foreground break-words text-xs sm:text-sm ${valueClassName} ${
        isMono ? "font-mono" : ""
      }`}
    >
      {value}
    </div>
  </div>
);

export default function TransactionItem({
  transaction,
  onTransactionUpdate,
}: TransactionItemProps) {
  const {
    id,
    productName,
    details,
    status,
    timestamp,
    serialNumber,
    failureReason,
    buyerSkuCode,
    originalCustomerNo,
    iconName,
    provider,
    costPrice,
    productBrandFromProvider,
    source,
    providerTransactionId,
    transactedBy,
  } = transaction;

  const effectiveSellingPrice = useMemo(() => {
    return getEffectiveSellingPrice(buyerSkuCode, provider, costPrice);
  }, [buyerSkuCode, provider, costPrice]);

  const { toast } = useToast();
  const router = useRouter();

  const ProductIconComponent =
    productIconsMapping[iconName] || productIconsMapping["Default"];

  const currentStatusConfig = statusConfig[status] || statusConfig["Gagal"];
  const SIcon = currentStatusConfig.icon;

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleViewReceipt = () => {
    if (status === "Sukses") {
      router.push(`/receipt/${id}`);
    } else {
      toast({
        title: "Receipt Not Available",
        description:
          "A receipt can only be viewed for successful transactions.",
        variant: "default",
      });
    }
  };

  const handleCheckStatus = async () => {
    if (!id) {
      toast({
        title: "Error",
        description: "Transaction ID is missing.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingStatus(true);
    try {
      let newStatus: TransactionStatus | undefined;
      let snFromProvider: string | null | undefined = null;
      let messageFromProvider: string | null | undefined = null;
      let trxIdFromProvider: string | null | undefined = null;
      let priceFromProvider: number | null | undefined = null;

      if (provider === "tokovoucher") {
        const tokovoucherStatusResult =
          await checkTokoVoucherTransactionStatus({ ref_id: id });
        if (tokovoucherStatusResult.isSuccess) {
          newStatus = tokovoucherStatusResult.status;
          snFromProvider = tokovoucherStatusResult.sn;
          messageFromProvider = tokovoucherStatusResult.message;
          trxIdFromProvider = tokovoucherStatusResult.trx_id;
          priceFromProvider = tokovoucherStatusResult.price;
        } else {
          toast({
            title: "Status Check Info",
            description:
              tokovoucherStatusResult.message ||
              "Could not get status from TokoVoucher.",
            variant: "default",
          });
          setIsCheckingStatus(false);
          return;
        }
      } else {
        // digiflazz
        if (!buyerSkuCode || !originalCustomerNo) {
          toast({
            title: "Error",
            description: "Missing data for Digiflazz status check.",
            variant: "destructive",
          });
          setIsCheckingStatus(false);
          return;
        }
        const digiflazzResult = await purchaseDigiflazzProduct({
          buyerSkuCode: buyerSkuCode,
          customerNo: originalCustomerNo,
          refId: id,
        });
        newStatus = digiflazzResult.status as TransactionStatus | undefined;
        snFromProvider = digiflazzResult.sn;
        messageFromProvider = digiflazzResult.message;
        priceFromProvider = digiflazzResult.price;
      }

      if (newStatus && newStatus !== status) {
        const updateData: any = {
          id: id,
          status: newStatus,
          serialNumber: snFromProvider || undefined,
          failureReason:
            newStatus === "Gagal"
              ? messageFromProvider ||
                (provider === "tokovoucher" && snFromProvider)
              : undefined,
          providerTransactionId: trxIdFromProvider || undefined,
          costPrice: priceFromProvider ?? undefined,
        };

        const updateResult = await updateTransactionInDB(updateData);
        if (updateResult.success) {
          const freshTx = await getTransactionByIdFromDB(id);
          if (freshTx) {
            trySendTelegramNotification({
              refId: freshTx.id,
              productName: freshTx.productName,
              customerNoDisplay: freshTx.details,
              status: newStatus,
              provider: freshTx.provider,
              costPrice: updateData.costPrice ?? freshTx.costPrice,
              sellingPrice: freshTx.sellingPrice,
              profit:
                newStatus === "Sukses"
                  ? freshTx.sellingPrice -
                    (updateData.costPrice ?? freshTx.costPrice)
                  : undefined,
              sn: updateData.serialNumber || null,
              failureReason: updateData.failureReason || null,
              timestamp: new Date(),
              additionalInfo: "Manual Check",
              trxId: updateData.providerTransactionId || freshTx.providerTransactionId,
              transactedBy: freshTx.transactedBy,
            });
          }
          toast({
            title: "Status Updated",
            description: `Transaction status changed to ${newStatus}. ${
              messageFromProvider || ""
            }`,
          });
          onTransactionUpdate();
        } else {
          toast({
            title: "DB Update Failed",
            description: updateResult.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Status Unchanged",
          description: `Transaction is still ${status}. ${
            messageFromProvider || "No new information."
          }`,
        });
      }
    } catch (error) {
      console.error("Error checking transaction status:", error);
      toast({
        title: "Error Checking Status",
        description:
          error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingStatus(false);
      setIsDetailsDialogOpen(false);
    }
  };

  const handleDeleteTransaction = async () => {
    const deleteResult = await deleteTransactionFromDB(id);
    if (deleteResult.success) {
      toast({
        title: "Transaction Deleted",
        description: `Transaction ID ${id} has been removed from history.`,
      });
      onTransactionUpdate();
    } else {
      toast({
        title: "Deletion Failed",
        description:
          deleteResult.message ||
          `Could not delete transaction ID ${id}.`,
        variant: "destructive",
      });
    }
    setIsConfirmingDelete(false);
    setIsDetailsDialogOpen(false);
  };

  const handleCopySn = () => {
    if (serialNumber) {
      navigator.clipboard
        .writeText(serialNumber)
        .then(() => {
          toast({
            title: "SN Copied!",
            description: "Serial number copied to clipboard.",
          });
        })
        .catch((err) => {
          console.error("Failed to copy SN:", err);
          toast({
            title: "Copy Failed",
            description: "Could not copy serial number.",
            variant: "destructive",
          });
        });
    }
  };

  const providerDisplayName =
    provider === "tokovoucher" ? "TokoVoucher" : "Digiflazz";
  const providerColorClass =
    provider === "tokovoucher"
      ? "border-blue-500/50 text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-400/50"
      : "border-purple-500/50 text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-900/30 dark:border-purple-400/50";

  const getCategoryColor = () => {
    const gameKeywords = [
      "GAME",
      "FREE FIRE",
      "MOBILE LEGENDS",
      "GENSHIN IMPACT",
      "HONKAI STAR RAIL",
    ];
    const productNameUpper = (productName || "").toUpperCase();
    const iconNameUpper = (iconName || "").toUpperCase();

    if (
      gameKeywords.some(
        (kw) => iconNameUpper.includes(kw) || productNameUpper.includes(kw)
      )
    ) {
      return productCategoryColors["Game"];
    } else if (iconNameUpper.includes("PULSA")) {
      return productCategoryColors["Pulsa"];
    } else if (
      iconNameUpper.includes("TOKEN") ||
      iconNameUpper.includes("PLN")
    ) {
      return productCategoryColors["Token Listrik"];
    } else if (iconNameUpper.includes("E-MONEY")) {
      return productCategoryColors["E-Money"];
    }
    return productCategoryColors["Default"];
  };

  const categoryColor = getCategoryColor();

  return (
    <>
      <AlertDialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <AlertDialogTrigger asChild>
          <Card
            className={`overflow-hidden transaction-card ${categoryColor.cssClass} shadow-md hover:shadow-lg cursor-pointer relative border-t-4 border-t-primary/80 group`}
          >
            <div
              className={`absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-br ${categoryColor.gradient} transition-opacity duration-300`}
            />
            <div className="absolute top-2 right-2">
              <Badge
                variant={
                  status === "Sukses"
                    ? "default"
                    : status === "Gagal"
                    ? "destructive"
                    : "secondary"
                }
                className={`status-badge ${
                  status === "Sukses"
                    ? "bg-green-100 text-green-800 border-green-300 shadow dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50"
                    : status === "Gagal"
                    ? "bg-red-100 text-red-800 border-red-300 shadow dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50"
                    : "bg-yellow-100 text-yellow-800 border-yellow-300 shadow dark:bg-yellow-900/30 dark:text-yellow-700 dark:border-yellow-700/50"
                }`}
              >
                <SIcon
                  className={`mr-1 h-3 w-3 ${
                    status === "Pending" ? "animate-spin" : ""
                  }`}
                />
                {currentStatusConfig.displayText}
              </Badge>
            </div>
            <CardHeader className="pb-1 pt-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-full ${categoryColor.light} ${categoryColor.dark} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                >
                  <ProductIconComponent className={`h-6 w-6 ${categoryColor.icon}`} />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold font-headline line-clamp-1">
                    {productName}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${providerColorClass}`}
                    >
                      {providerDisplayName}
                    </Badge>
                    {productBrandFromProvider && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-slate-50 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {productBrandFromProvider}
                      </Badge>
                    )}
                    {transactedBy && (
                      <Badge className="text-xs border-gray-400/50 text-gray-600 bg-gray-50" variant="outline">
                        <UserCircle className="h-3 w-3 mr-1" /> {transactedBy}
                      </Badge>
                    )}
                    {source === "telegram_bot" && (
                      <Badge
                        variant="outline"
                        className="text-xs border-sky-500/50 text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-900/30 dark:border-sky-400/50"
                      >
                        <Bot className="h-3 w-3 mr-1" /> via Telegram
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3 pb-4">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-1">
                  <div className="flex items-center text-sm">
                    <Info className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium line-clamp-1">{details}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <DollarSign className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-primary">
                      Rp {effectiveSellingPrice.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{new Date(timestamp).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="font-mono">...{id.slice(-6)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AlertDialogTrigger>
        <AlertDialogContent className="sm:max-w-lg overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 font-headline text-xl">
              <div className={`p-2 rounded-full ${categoryColor.light} ${categoryColor.dark}`}>
                <ProductIconComponent className={`h-6 w-6 ${categoryColor.icon}`} />
              </div>
              Transaction Details
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Details of transaction {id}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 py-1 pr-4">
              <div className="flex justify-between items-center">
                <DetailRow
                  icon={CalendarDays}
                  label="Date"
                  value={new Date(timestamp).toLocaleString("id-ID")}
                />
                <Badge
                  variant={
                    status === "Sukses"
                      ? "default"
                      : status === "Gagal"
                      ? "destructive"
                      : "secondary"
                  }
                  className={`${
                    status === "Sukses"
                      ? "bg-green-100 text-green-800 border-green-300 shadow-sm dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50"
                      : status === "Gagal"
                      ? "bg-red-100 text-red-800 border-red-300 shadow-sm dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50"
                      : "bg-yellow-100 text-yellow-800 border-yellow-300 shadow-sm dark:bg-yellow-900/30 dark:text-yellow-700 dark:border-yellow-700/50"
                  }`}
                >
                  <SIcon className={`mr-1 h-3.5 w-3.5 ${status === "Pending" ? "animate-spin" : ""}`} />
                  {currentStatusConfig.displayText}
                </Badge>
              </div>
              <Separator className="my-2" />
              <DetailRow icon={Briefcase} label="Product" value={productName} valueClassName="font-semibold" />
              <DetailRow icon={Info} label="Details" value={details} />
              {transactedBy && (
                <DetailRow icon={UserCircle} label="User" value={transactedBy} valueClassName="font-semibold" />
              )}
              <DetailRow
                icon={Building}
                label="Provider"
                value={providerDisplayName}
                valueClassName={`capitalize font-semibold ${
                  provider === "tokovoucher" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"
                }`}
              />
              {source === "telegram_bot" && (
                <DetailRow icon={Bot} label="Source" value="Telegram Bot" valueClassName="text-sky-700 font-semibold" />
              )}
              <Separator className="my-3" />
              <DetailRow icon={Hash} label="Ref ID" value={<span className="font-mono">{id}</span>} />
              {providerTransactionId && (
                <DetailRow icon={Server} label="Provider Trx ID" value={<span className="font-mono">{providerTransactionId}</span>} />
              )}
              <DetailRow icon={Code2} label="SKU Code" value={<span className="font-mono">{buyerSkuCode}</span>} />
              <DetailRow icon={UserSquare2} label="Original Customer No" value={<span className="font-mono">{originalCustomerNo}</span>} />

              <div className="p-3 rounded-md bg-muted/50 border border-border/50 mt-3 space-y-3">
                <DetailRow
                  icon={DollarSign}
                  label="Selling Price"
                  value={`Rp ${effectiveSellingPrice.toLocaleString("id-ID")}`}
                  valueClassName="font-semibold text-primary"
                />
                {status === "Sukses" && typeof costPrice === "number" && (
                  <>
                    <DetailRow icon={DollarSign} label="Cost Price" value={`Rp ${Number(costPrice).toLocaleString("id-ID")}`} />
                    <DetailRow
                      icon={DollarSign}
                      label="Profit"
                      value={`Rp ${(effectiveSellingPrice - Number(costPrice)).toLocaleString("id-ID")}`}
                      valueClassName={`font-semibold ${
                        effectiveSellingPrice - Number(costPrice) >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    />
                  </>
                )}
              </div>

              {status === "Sukses" && serialNumber && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center text-muted-foreground">
                    <Ticket className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="font-medium text-xs sm:text-sm">Serial Number (SN):</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-700/50 shadow-sm">
                    <span className="font-mono text-green-700 dark:text-green-300 text-sm sm:text-base break-all">
                      {serialNumber}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopySn}
                      className="h-8 w-8 ml-2 text-green-600 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/30"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {status === "Gagal" && failureReason && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-700/50 space-y-1 mt-2">
                  <div className="flex items-center text-red-800 dark:text-red-300">
                    <LucideAlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="font-medium text-xs sm:text-sm">Failure Reason:</span>
                  </div>
                  <p className="text-red-700 dark:text-red-300 text-sm pl-6">{failureReason}</p>
                </div>
              )}

              {status === "Pending" && (
                <div className="flex items-center p-3 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-700/50 shadow-sm mt-2">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                  <p className="text-xs sm:text-sm">
                    This transaction is currently being processed. You can check the status to see if it has completed.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4 mt-2">
            <Button
              variant="destructive"
              onClick={() => setIsConfirmingDelete(true)}
              className="w-full sm:w-auto shrink-0"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
            
            {status === 'Pending' && (
                <Button
                    variant="default"
                    onClick={handleCheckStatus}
                    disabled={isCheckingStatus}
                    className="w-full sm:w-auto shrink-0"
                >
                    {isCheckingStatus ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Check Status
                </Button>
            )}

            {status === "Sukses" && (
              <Button
                  variant="outline"
                  onClick={handleViewReceipt}
                  className="w-full sm:w-auto hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-700/50 text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 shrink-0"
                >
                  <FileText className="mr-2 h-4 w-4" /> View Receipt
              </Button>
            )}
            
            <AlertDialogCancel className="w-full sm:w-auto mt-0">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog konfirmasi hapus */}
      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this transaction?
              <div className="mt-2 p-2 bg-muted/50 rounded border border-muted">
                <span className="font-mono text-xs text-foreground">ID: {id}</span>
              </div>
              <p className="mt-2 text-sm font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleDeleteTransaction} className="bg-red-600 text-white hover:bg-red-700">
              <Trash2 className="mr-1.5 h-4 w-4" />
              Confirm Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
