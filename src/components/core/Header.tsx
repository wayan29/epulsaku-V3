// src/components/core/Header.tsx
"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, LayoutDashboard, History, LogOut, UserCircle2, Menu, DollarSign, Settings, KeyRound, ShieldCheck, TrendingUp, Shield, ShieldAlert, ShoppingCart, Cog, PackageSearch, BarChart3, Home, Wrench, Contact, Phone, UserCog, UserPlus, FileText, MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ModeToggle } from "./ModeToggle";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ALL_APP_MENUS, AppMenu } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  isActive: boolean;
}

const NavLink = ({ href, children, icon, onClick, isActive }: NavLinkProps) => (
  <Button 
    variant="ghost" 
    asChild 
    className={cn(
        "justify-start w-full transition-all duration-200",
        isActive ? "bg-primary/10 text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
    )} 
    onClick={onClick}
  >
    <Link href={href} className="flex items-center gap-3 py-2 px-3">
      {icon ? React.cloneElement(icon as React.ReactElement, { className: cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground") }) : null}
      <span className="text-sm">{children}</span>
    </Link>
  </Button>
);

export default function Header() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    logout();
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };
  
  const hasAccess = (menuKey: string) => {
    if(!user) return false;
    if(user.role === 'super_admin' || (user.permissions && user.permissions.includes('all_access'))) return true;
    return user.permissions && user.permissions.includes(menuKey);
  }

  const sidebarNavGroups = [
    {
      label: "Utama",
      icon: <Home className="h-5 w-5" />,
      items: ALL_APP_MENUS.filter(m => ['dashboard'].includes(m.key) && hasAccess(m.key))
    },
    {
      label: "Produk",
      icon: <PackageSearch className="h-5 w-5" />,
      items: ALL_APP_MENUS.filter(m => ['layanan_digiflazz', 'layanan_tokovoucher'].includes(m.key) && hasAccess(m.key))
    },
    {
      label: "Riwayat & Laporan",
      icon: <BarChart3 className="h-5 w-5" />,
      items: ALL_APP_MENUS.filter(m => ['riwayat_transaksi', 'laporan_profit'].includes(m.key) && hasAccess(m.key))
    },
    {
      label: "Alat",
      icon: <Wrench className="h-5 w-5" />,
      items: ALL_APP_MENUS.filter(m => ['cek_nickname_game', 'cek_id_pln', 'cek_operator_seluler', 'chat_ai'].includes(m.key) && hasAccess(m.key))
    },
  ];

  const roleDisplayMap: Record<string, string> = {
    'staf': 'Staf',
    'admin': 'Admin',
    'super_admin': 'Super Admin',
  };
  const roleColorMap: Record<string, string> = {
    'staf': 'bg-blue-100 text-blue-800 border-blue-300',
    'admin': 'bg-purple-100 text-purple-800 border-purple-300',
    'super_admin': 'bg-red-100 text-red-800 border-red-300',
  };


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6 text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <SheetHeader className="text-left p-4 border-b">
                <SheetTitle className="flex items-center gap-2 text-primary text-xl font-bold font-headline">
                  <Zap className="h-7 w-7" />
                  ePulsaku Menu
                </SheetTitle>
              </SheetHeader>
              
              <ScrollArea className="flex-1">
                <nav className="flex flex-col gap-2 p-4">
                  {sidebarNavGroups.filter(g => g.items.length > 0).map((group, index) => {
                    const Icon = group.icon;
                    return (
                      <div key={group.label} className="space-y-1">
                          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</h3>
                          <div className="flex flex-col gap-0.5">
                              {group.items.map((item) => (
                                  <SheetClose asChild key={`sidebar-${item.href}`} onClick={() => setIsSheetOpen(false)}>
                                      <NavLink href={item.href} icon={item.icon ? <item.icon /> : <Zap className="h-4 w-4"/>} isActive={pathname === item.href}>
                                          {item.label}
                                      </NavLink>
                                  </SheetClose>
                              ))}
                          </div>
                          {index < sidebarNavGroups.filter(g => g.items.length > 0).length - 1 && <Separator className="my-2"/>}
                      </div>
                    )
                  })}
                </nav>
              </ScrollArea>

              {user && (
                <div className="mt-auto p-4 border-t space-y-2">
                   <div className="px-2 mb-2 flex items-center justify-between gap-2 text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{user.username}</span>
                        <Badge variant="outline" className={cn('capitalize text-xs w-fit mt-1', roleColorMap[user.role] || 'border-gray-300')}>
                           {roleDisplayMap[user.role] || user.role}
                        </Badge>
                      </div>
                      <SheetClose asChild onClick={() => setIsSheetOpen(false)}>
                         <Link href="/account">
                           <Button variant="ghost" size="icon">
                              <Settings className="h-5 w-5" />
                              <span className="sr-only">Account Settings</span>
                           </Button>
                         </Link>
                      </SheetClose>
                   </div>
                  
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <LogOut className="mr-3 h-5 w-5" /> Logout
                    </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="flex items-center gap-2 text-primary ml-2">
            <Zap className="h-8 w-8 md:h-7 md:w-7" />
            <span className="text-2xl md:text-xl font-bold font-headline">ePulsaku</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
            <ModeToggle />
        </div>
      </div>
    </header>
  );
}
