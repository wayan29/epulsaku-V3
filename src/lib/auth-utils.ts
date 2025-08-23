// src/lib/auth-utils.ts

// This file contains constants and types related to authentication.
// It does NOT contain any server-side logic and is safe to import into client components.

import jwt from 'jsonwebtoken';
import { LayoutDashboard, ShoppingCart, History, TrendingUp, Wrench, MessageSquare, UserCog, Settings, DollarSign, ShieldAlert, UserPlus, KeyRound, ShieldCheck, Contact, Phone, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// --- CONSTANTS ---
export const SALT_ROUNDS = 10;
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRATION = '8h'; // Shortened session timeout
export const JWT_REMEMBER_ME_EXPIRATION = '7d'; // Shortened "remember me" timeout
export const AUTH_COOKIE_NAME = 'ePulsakuAuthToken_v1';
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_PERIOD_MS = 2 * 60 * 1000;

// --- TYPES & INTERFACES ---
export type UserRole = 'staf' | 'admin' | 'super_admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  permissions: string[]; // Added user-specific permissions
}

export interface StoredUser {
  _id: string;
  username: string;
  email?: string;
  hashedPassword?: string;
  hashedPin?: string;
  role: UserRole;
  permissions: string[]; // Added user-specific permissions
  createdBy?: string;
  telegramChatId?: string;
  isDisabled?: boolean;
  failedPinAttempts?: number;
}

export interface LoginActivity {
  _id: string;
  userId: string;
  username: string;
  loginTimestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface UserUpdatePayload {
    email?: string;
    role?: UserRole;
    permissions?: string[];
    newPassword?: string;
    newPin?: string;
    telegramChatId?: string;
}

// Function to generate a JWT
export function generateToken(user: User, rememberMe?: boolean): string {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured on the server.");
    }
    const payload = {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions, // Include permissions in the token
    };
    const expiresIn = rememberMe ? JWT_REMEMBER_ME_EXPIRATION : JWT_EXPIRATION;
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// --- Menu Permissions ---
export interface AppMenu {
    key: string;
    href: string;
    label: string;
    description: string;
    icon?: LucideIcon;
    roles?: ('admin' | 'staf')[]; // Optional: for default roles if needed
}

export const ALL_APP_MENUS: AppMenu[] = [
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Halaman ringkasan utama.' },
  { key: 'layanan_digiflazz', href: '/layanan/digiflazz', label: 'Layanan Digiflazz', icon: ShoppingCart, description: 'Akses produk dari Digiflazz.' },
  { key: 'layanan_tokovoucher', href: '/order/tokovoucher', label: 'Layanan TokoVoucher', icon: ShoppingCart, description: 'Akses produk dari TokoVoucher.' },
  { key: 'riwayat_transaksi', href: '/transactions', label: 'Riwayat Transaksi', icon: History, description: 'Lihat semua log transaksi.' },
  { key: 'laporan_profit', href: '/profit-report', label: 'Laporan Profit & Statement', icon: TrendingUp, description: 'Analisis keuntungan dan detail transaksi.' },
  { key: 'cek_nickname_game', href: '/tools/game-nickname-checker', label: 'Cek Nickname Game', icon: Contact, description: 'Alat bantu cek ID game.' },
  { key: 'cek_id_pln', href: '/tools/pln-checker', label: 'Cek ID Pelanggan PLN', icon: Zap, description: 'Alat bantu cek ID PLN.' },
  { key: 'cek_operator_seluler', href: '/tools/operator-checker', label: 'Cek Operator Seluler', icon: Phone, description: 'Alat bantu cek nomor HP.' },
  { key: 'chat_ai', href: '/tools/chat', label: 'Chat AI Gemini', icon: MessageSquare, description: 'Asisten AI untuk membantu Anda.' },
  { key: 'pengaturan_akun', href: '/account', label: 'Pengaturan Akun & Keamanan', icon: UserCog, description: 'Ganti password, PIN, dll.' },
  { key: 'pengaturan_admin', href: '/admin-settings', label: 'Pengaturan Kredensial Admin', icon: ShieldAlert, description: 'Kelola API Key provider.' },
  { key: 'pengaturan_harga_digiflazz', href: '/price-settings', label: 'Pengaturan Harga Digiflazz', icon: DollarSign, description: 'Set harga jual produk Digiflazz.' },
  { key: 'pengaturan_harga_tokovoucher', href: '/tokovoucher-price-settings', label: 'Pengaturan Harga TokoVoucher', icon: DollarSign, description: 'Set harga jual produk TokoVoucher.' },
  { key: 'manajemen_pengguna', href: '/management/users', label: 'Manajemen Pengguna', icon: UserPlus, description: 'Tambah atau kelola staf/admin.', roles: ['super_admin'] },
];
