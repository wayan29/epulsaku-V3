// src/app/(app)/account/page.tsx
"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Settings, DollarSign, ShieldAlert, History, UserPlus, KeyRound as KeyIcon, FileText, TrendingUp, Wrench, Contact, Phone, Zap, UserCog, KeyRound, Smartphone, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_APP_MENUS } from '@/lib/auth-utils';
import { useEffect, useState } from 'react';

// Define sub-menus for the account section explicitly
const accountSubMenus = [
  { href: '/account/change-password', label: 'Ganti Password', description: 'Perbarui password akun Anda.', icon: KeyRound, key: 'pengaturan_akun' },
  { href: '/account/change-pin', label: 'Ganti PIN Transaksi', description: 'Perbarui PIN 6-digit Anda.', icon: KeyIcon, key: 'pengaturan_akun' },
  { href: '/account/login-activity', label: 'Aktivitas Login', description: 'Lihat riwayat login terakhir.', icon: Activity, key: 'pengaturan_akun' },
];

const adminLinks = ALL_APP_MENUS.filter(m => !['pengaturan_akun', 'manajemen_pengguna'].includes(m.key) && !m.href.startsWith('/tools'));
const managementLinks = ALL_APP_MENUS.filter(m => ['manajemen_pengguna'].includes(m.key));
const toolsLinks = ALL_APP_MENUS.filter(m => m.href.startsWith('/tools'));

export default function AccountHubPage() {
  const { user } = useAuth();
  
  if (!user) return null;

  const hasAccess = (key: string) => {
    if (user.role === 'super_admin' || (user.permissions && user.permissions.includes('all_access'))) return true;
    return user.permissions && user.permissions.includes(key);
  };

  const visibleAccountSubMenus = accountSubMenus.filter(link => hasAccess(link.key));
  const visibleAdminLinks = adminLinks.filter(link => hasAccess(link.key));
  const visibleManagementLinks = managementLinks.filter(link => hasAccess(link.key));
  const visibleToolsLinks = toolsLinks.filter(link => hasAccess(link.key));

  return (
    <div className="space-y-6">
      {visibleAccountSubMenus.length > 0 && (
        <div>
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="h-6 w-6 text-primary"/>
              <h2 className="text-xl font-semibold font-headline">Keamanan Akun</h2>
            </div>
            <div className="space-y-3">
            {visibleAccountSubMenus.map((link) => {
              const Icon = link.icon;
              return (
              <Link href={link.href} key={link.href} className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                  <div className="flex items-center gap-4">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{link.label}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            )})}
            </div>
        </div>
      )}
      
      {visibleAdminLinks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
              <Settings className="h-6 w-6 text-primary"/>
              <h2 className="text-xl font-semibold font-headline">Pengaturan & Laporan</h2>
            </div>
          <div className="space-y-3">
            {visibleAdminLinks.map((link) => {
                 let Icon = Zap;
                 if (link.key.includes('harga')) Icon = DollarSign;
                 if (link.key.includes('riwayat')) Icon = History;
                 if (link.key.includes('laporan')) Icon = TrendingUp;
                 if (link.key.includes('admin')) Icon = ShieldAlert;
                return (
                <Link href={link.href} key={link.href} className="block">
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                    <div className="flex items-center gap-4">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold">{link.label}</h3>
                          <p className="text-sm text-muted-foreground">{link.description}</p>
                        </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
            )})}
          </div>
        </div>
      )}

      {visibleManagementLinks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
              <UserPlus className="h-6 w-6 text-primary"/>
              <h2 className="text-xl font-semibold font-headline">Manajemen</h2>
            </div>
          <div className="space-y-3">
            {visibleManagementLinks.map((link) => (
              <Link href={link.href} key={link.href} className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                  <div className="flex items-center gap-4">
                    <UserCog className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{link.label}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {visibleToolsLinks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
              <Wrench className="h-6 w-6 text-primary"/>
              <h2 className="text-xl font-semibold font-headline">Alat & Utilitas</h2>
            </div>
          <div className="space-y-3">
            {visibleToolsLinks.map((link) => {
                 let Icon = Wrench;
                 if (link.key.includes('game')) Icon = Contact;
                 if (link.key.includes('pln')) Icon = Zap;
                 if (link.key.includes('operator')) Icon = Phone;
                 return (
              <Link href={link.href} key={link.href} className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                  <div className="flex items-center gap-4">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{link.label}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            )})}
          </div>
        </div>
      )}

    </div>
  );
}
