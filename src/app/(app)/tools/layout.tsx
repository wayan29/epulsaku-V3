
// src/app/(app)/tools/layout.tsx
import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

// Dynamically generate metadata based on the last segment of the path
export async function generateMetadata({ params }: { params: { slug: string } }) {
  // This is a basic way to get the last part of the route. For more complex nested routes, you might need a different approach.
  // We'll rely on the page itself to provide the title via its component structure. This metadata is more of a fallback.
  const pathSegments = (params.slug || "").split('/');
  const lastSegment = pathSegments[pathSegments.length - 1] || 'Tools';
  const title = lastSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return {
    title: `${title} - ePulsaku Tools`,
    description: `Utility tools for ePulsaku application, including checkers and calculators.`,
  };
}


export default function ToolsLayout({ children }: { children: ReactNode }) {
  // We cannot dynamically set CardTitle/Description here easily based on route.
  // So, each page will render its own CardHeader inside the CardContent provided by this layout.
  // This is a simpler approach for this structure.
  
  return (
    <div className="flex justify-center py-8">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
           <div className="flex items-center gap-3 mb-2">
             <Wrench className="h-8 w-8 text-primary" />
             <CardTitle className="text-xl sm:text-2xl font-headline">Alat & Utilitas</CardTitle>
           </div>
           <CardDescription>
             Gunakan alat bantu di bawah ini untuk melakukan pengecekan cepat terkait produk dan layanan.
           </CardDescription>
        </CardHeader>
        {children}
      </Card>
    </div>
  );
}
