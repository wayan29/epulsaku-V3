
// src/app/(app)/receipt/[transactionId]/page.tsx
"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTransactionByIdFromDB } from '@/lib/transaction-utils'; 
import type { Transaction } from '@/components/transactions/TransactionItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Printer, CheckCircle2, XCircle, Loader2, Info, Share2, DollarSign } from 'lucide-react';
import { productIconsMapping } from '@/components/transactions/TransactionItem';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { getEffectiveSellingPrice } from '@/lib/price-settings-utils'; // Import the new utility

type PaperSize = "a4" | "thermal" | "dot-matrix" | "small";

const paperSizeOptions: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4 Paper" },
  { value: "thermal", label: "Thermal Printer (80mm)" },
  { value: "dot-matrix", label: "Dot Matrix" },
  { value: "small", label: "Small Slip" },
];

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const transactionId = params.transactionId as string;
  const [transaction, setTransaction] = useState<Transaction | null | undefined>(undefined); 
  const receiptContentRef = useRef<HTMLDivElement>(null);
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>("a4");
  const [isLoading, setIsLoading] = useState(true);
  const [formattedDate, setFormattedDate] = useState<string>('');
  const [formattedExpiryDate, setFormattedExpiryDate] = useState<string>('');

  const [customSellingPrice, setCustomSellingPrice] = useState<number>(0);

  const effectiveSellingPrice = useMemo(() => {
    if (transaction) {
      return getEffectiveSellingPrice(transaction.buyerSkuCode, transaction.provider, transaction.costPrice);
    }
    return 0;
  }, [transaction]);
  
  const profit = useMemo(() => {
    if (transaction) {
      return customSellingPrice - transaction.costPrice;
    }
    return 0;
  }, [transaction, customSellingPrice]);


  useEffect(() => {
    async function fetchTransaction() {
      if (transactionId) {
        setIsLoading(true);
        const foundTransaction = await getTransactionByIdFromDB(transactionId);
        setTransaction(foundTransaction);
        setIsLoading(false);
      } else {
        setTransaction(null); 
        setIsLoading(false);
      }
    }
    fetchTransaction();
  }, [transactionId]);

  useEffect(() => {
    if (transaction) {
      setFormattedDate(new Date(transaction.timestamp).toLocaleString());
      const price = getEffectiveSellingPrice(transaction.buyerSkuCode, transaction.provider, transaction.costPrice);
      setCustomSellingPrice(price);
    }
    if (transaction && (transaction as any).expired_at) {
      setFormattedExpiryDate(new Date((transaction as any).expired_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }));
    }
  }, [transaction]);


  const handlePrint = () => {
    const printContent = receiptContentRef.current;
    if (printContent) {
      const printWindow = window.open('', '_blank', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Receipt</title>');
        
        const stylesheets = Array.from(document.styleSheets)
          .map(sheet => {
            try {
              return sheet.href ? `<link rel="stylesheet" href="${sheet.href}">` : '';
            } catch (e) {
              console.warn('Could not access stylesheet:', sheet.href, e);
              return '';
            }
          })
          .filter(Boolean)
          .join('');
        printWindow.document.write(stylesheets);

        printWindow.document.write(`
          <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .receipt-container { margin: 20px; box-sizing: border-box; }
            .no-print-in-new-window { display: none !important; }
            .receipt-price-input { display: none !important; }
            .receipt-price-display { display: block !important; }
            @media print {
              body { margin:0; padding:0; background-color: white !important; color: black !important; }
              .no-print-in-new-window { display: none !important; }
              .receipt-container { margin: 0 !important; padding: 0 !important; width: 100%; box-sizing: border-box; }
              
              .print-a4 .receipt-container { width: 190mm; padding: 10mm; margin: auto;}
              .print-a4 .text-primary { color: #8000FF !important; }
              .print-a4 .text-green-500 { color: #22C55E !important; }
              .print-a4 .text-green-600 { color: #16A34A !important; }
              .print-a4 .text-green-700 { color: #15803d !important; }
              .print-a4 .bg-primary\\/5 { background-color: rgba(128, 0, 255, 0.05) !important; }
              .print-a4 .bg-primary\\/10 { background-color: rgba(128, 0, 255, 0.1) !important; }
              .print-a4 .bg-muted { background-color: #F0E6FF !important; }

              .print-thermal .receipt-container { width: 72mm; font-size: 10pt; line-height: 1.3; margin: 0; padding: 4mm; }
              .print-thermal .text-lg { font-size: 11pt; }
              .print-thermal .text-xl { font-size: 12pt; }
              .print-thermal .text-2xl { font-size: 13pt; }
              .print-thermal .text-xs { font-size: 8pt; }
              .print-thermal .font-mono { font-family: 'Courier New', Courier, monospace; }
              .print-thermal .separator-line { border-top: 1px dashed #555 !important; margin: 6px 0 !important; } 
              .print-thermal .details-item { display: flex; justify-content: space-between; margin-bottom: 2px;}
              .print-thermal .details-item span:first-child { flex-basis: 40%; text-align: left; padding-right: 5px; }
              .print-thermal .details-item span:last-child { flex-basis: 60%; text-align: right; }
              .print-thermal .card-header { padding: 8px !important; text-align: center !important; }
              .print-thermal .card-content { padding: 8px !important; }
              .print-thermal .card-title { font-size: 13pt !important; }
              .print-thermal .icon-large { width: 32px !important; height: 32px !important; margin-bottom: 4px !important;}
              .print-thermal .icon-small { width: 16px !important; height: 16px !important; }
              .print-thermal .bg-primary\\/5, .print-thermal .bg-primary\\/10, .print-thermal .bg-muted { background-color: transparent !important; }
              .print-thermal .border, .print-thermal .border-primary\\/30 { border: none !important; }
              .print-thermal .shadow-lg { box-shadow: none !important; }
              .print-thermal .rounded-full, .print-thermal .rounded-t-lg, .print-thermal .rounded-md { border-radius: 0 !important; }
              .print-thermal .text-primary, .print-thermal .text-green-500, .print-thermal .text-green-600, .print-thermal .text-green-700 { color: black !important; }
              .print-thermal .text-muted-foreground { color: #333 !important; }

              .print-dot-matrix .receipt-container { width: 100%; font-family: 'Courier New', Courier, monospace; font-size: 10pt; padding: 5mm; }
              .print-dot-matrix .separator-line { border-top: 1px solid #333 !important; margin: 5px 0 !important; }
              .print-dot-matrix .bg-primary\\/5, .print-dot-matrix .bg-primary\\/10, .print-dot-matrix .bg-muted { background-color: transparent !important; }
              .print-dot-matrix .border, .print-dot-matrix .border-primary\\/30 { border: none !important; }
              .print-dot-matrix .shadow-lg { box-shadow: none !important; }
              .print-dot-matrix .text-primary, .print-dot-matrix .text-green-500, .print-dot-matrix .text-green-600, .print-dot-matrix .text-green-700 { color: black !important; }

              .print-small .receipt-container { width: 90mm; font-size: 9pt; padding: 5mm; margin: auto; }
              .print-small .separator-line { border-top: 1px dashed #777 !important; margin: 6px 0 !important; }
              .print-small .bg-primary\\/5 { background-color: rgba(128, 0, 255, 0.05) !important; }
              .print-small .bg-primary\\/10 { background-color: rgba(128, 0, 255, 0.1) !important; }
              .print-small .bg-muted { background-color: #F0E6FF !important; }
              .print-small .text-primary { color: #8000FF !important; }
              .print-small .text-green-500 { color: #22C55E !important; }
              .print-small .text-green-600 { color: #16A34A !important; }
              .print-small .text-green-700 { color: #15803d !important; }
            }
          </style>
        `);
        
        printWindow.document.write(`</head><body class="print-${selectedPaperSize}">`);
        printWindow.document.write('<div class="receipt-container">');
        const clonedContent = printContent.cloneNode(true) as HTMLElement;
        if (selectedPaperSize === 'thermal') {
            const mainIcon = clonedContent.querySelector('.h-16.w-16.text-green-500');
            if (mainIcon) {
                mainIcon.classList.remove('h-16', 'w-16');
                mainIcon.classList.add('icon-large');
            }
            const productIconElement = clonedContent.querySelector('.h-6.w-6.text-primary');
            if (productIconElement) {
                productIconElement.classList.remove('h-6', 'w-6');
                productIconElement.classList.add('icon-small');
            }
        }
        printWindow.document.write(clonedContent.innerHTML);
        printWindow.document.write('</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        printWindow.onload = function() {
          setTimeout(() => { 
            printWindow.focus();
            printWindow.print();
            // printWindow.close(); // Consider closing after print
          }, 250);
        };
      } else {
        toast({ title: "Print Error", description: "Could not open print window. Please check your browser's popup blocker settings.", variant: "destructive" });
      }
    }
  };

  const handleShare = async () => {
    if (!transaction || !receiptContentRef.current) {
      toast({ title: "Share Error", description: "Receipt data not available.", variant: "destructive" });
      return;
    }

    const shareData = {
      title: `Receipt: ${transaction.productName}`,
      text: `My ePulsaku receipt for ${transaction.productName} (Rp ${customSellingPrice.toLocaleString()}). Transaction ID: ${transaction.id.slice(-8)}. SN: ${transaction.serialNumber || 'N/A'}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Shared Successfully", description: "Receipt details shared." });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast({ title: "Share Failed", description: (error as Error).message || "Could not share the receipt using native share.", variant: "destructive" });
          downloadReceiptAsImage();
        } 
      }
    } else {
      toast({ title: "Native Share Not Supported", description: "Downloading receipt as an image instead.", variant: "default" });
      downloadReceiptAsImage();
    }
  };

  const downloadReceiptAsImage = async () => {
    if (!receiptContentRef.current || !transaction) return;
    try {
      const canvas = await html2canvas(receiptContentRef.current, {
        scale: 2, 
        useCORS: true, 
        backgroundColor: null, 
      });
      const image = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `ePulsaku_Receipt_${transaction.id.slice(-6)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Download Started", description: "Receipt image is downloading." });
    } catch (error) {
      console.error("Error generating receipt image:", error);
      toast({ title: "Download Failed", description: "Could not generate receipt image.", variant: "destructive" });
    }
  };


  if (isLoading || transaction === undefined) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
        <p className="text-lg">Loading receipt...</p>
      </div>
    );
  }

  if (!transaction) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Transaction Not Found</h1>
        <p className="text-muted-foreground mb-6">The transaction ID provided does not match any recorded transaction.</p>
        <Button onClick={() => router.push('/transactions')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Transactions
        </Button>
      </div>
    );
  }
  
  if (transaction.status !== "Sukses") {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <Info className="h-16 w-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Receipt Not Available</h1>
        <p className="text-muted-foreground mb-6">
          A receipt can only be generated for successful transactions. This transaction is currently: <strong className={
            transaction.status === "Pending" ? "text-yellow-600" :
            transaction.status === "Gagal" ? "text-red-600" : ""
          }>{transaction.status}</strong>.
        </p>
        <Button onClick={() => router.push('/transactions')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Transactions
        </Button>
      </div>
    );
  }

  const ProductIcon = productIconsMapping[transaction.iconName] || productIconsMapping['Default'];

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <Button variant="outline" onClick={() => router.back()} className="mb-6 no-print">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div id="receipt-content-printable" ref={receiptContentRef}> 
        <Card className="shadow-lg border-primary/30">
          <CardHeader className="text-center bg-primary/5 rounded-t-lg pt-6 pb-4 card-header">
            <div className="mx-auto mb-3">
               <CheckCircle2 className="h-16 w-16 text-green-500 icon-large" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary card-title">Transaction Successful</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">Receipt ID: {transaction.id}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 card-content">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <ProductIcon className="h-6 w-6 text-primary icon-small" />
              </div>
              <div>
                <p className="font-semibold text-lg">{transaction.productName}</p>
                <p className="text-sm text-muted-foreground">{transaction.details}</p>
              </div>
            </div>

            <Separator className="separator-line" />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between details-item">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold text-green-600">{transaction.status}</span>
              </div>
              <div className="flex justify-between details-item">
                <span className="text-muted-foreground">Date & Time:</span>
                <span className="font-medium">{formattedDate || 'Loading...'}</span>
              </div>
              {transaction.productCategoryFromProvider && (
                  <div className="flex justify-between text-xs pt-1 details-item">
                      <span className="text-muted-foreground">Category:</span>
                      <span>{transaction.productCategoryFromProvider}</span>
                  </div>
              )}
              {transaction.productBrandFromProvider && (
                  <div className="flex justify-between text-xs details-item">
                      <span className="text-muted-foreground">Brand:</span>
                      <span>{transaction.productBrandFromProvider}</span>
                  </div>
              )}
               <div className="flex flex-col sm:flex-row justify-between pt-2 sm:items-center details-item">
                <span className="text-muted-foreground mb-1 sm:mb-0">Total Payment:</span>
                <div className="receipt-price-input">
                  <Input 
                    type="number"
                    value={customSellingPrice}
                    onChange={(e) => setCustomSellingPrice(Number(e.target.value))}
                    className="font-bold text-lg text-primary text-right h-9 w-full sm:max-w-[150px] p-1"
                  />
                </div>
                <span className="font-bold text-lg text-primary receipt-price-display hidden">
                  Rp {customSellingPrice.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between text-xs details-item no-print">
                <span className="text-muted-foreground">Profit:</span>
                <span className={`font-semibold ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Rp {profit.toLocaleString()}</span>
              </div>
              
              {transaction.serialNumber && (
                <div className="pt-3">
                  <p className="text-muted-foreground text-xs mb-1">Serial Number (SN) / Token:</p>
                  <div className="p-3 bg-muted rounded-md text-center">
                    <p className="font-mono text-lg font-semibold text-primary break-all">{transaction.serialNumber}</p>
                  </div>
                </div>
              )}
            </div>
            
            <Separator className="my-6 separator-line" />
            
            <p className="text-xs text-center text-muted-foreground">
              Thank you for your purchase at ePulsaku!
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 no-print space-y-3">
        <div>
          <Label htmlFor="paper-size-select" className="text-sm font-medium">Paper Size (for Print)</Label>
          <Select value={selectedPaperSize} onValueChange={(value) => setSelectedPaperSize(value as PaperSize)}>
            <SelectTrigger id="paper-size-select" className="w-full mt-1">
              <SelectValue placeholder="Select paper size" />
            </SelectTrigger>
            <SelectContent>
              {paperSizeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handlePrint} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button onClick={handleShare} className="w-full" variant="outline">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </div>
    </div>
  );
}
