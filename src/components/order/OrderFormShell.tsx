// src/components/order/OrderFormShell.tsx
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from 'lucide-react';

interface OrderFormShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}

export default function OrderFormShell({ title, description, icon: Icon, children }: OrderFormShellProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Icon className="h-8 w-8 text-primary" />
            <CardTitle className="text-xl sm:text-2xl font-headline">{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
