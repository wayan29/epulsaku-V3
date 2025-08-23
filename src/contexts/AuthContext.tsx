// src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/auth-utils';
import { Loader2 } from 'lucide-react';
import { verifyAuth } from '@/app/api/auth/actions'; // Using the server action for verification

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      // Server action now reads the HttpOnly cookie
      const { isAuthenticated: authStatus, user: authedUser } = await verifyAuth();
      setIsAuthenticated(authStatus);
      setUser(authedUser);
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username: string, password: string, rememberMe?: boolean) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, rememberMe }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // The cookie is set by the server. We just need to update the client state.
      setUser(data.user);
      setIsAuthenticated(true);
      router.push('/dashboard'); // Manually redirect after successful login
    } else {
      // Throw a custom error object to pass status and data to the caller
      const error = new Error(data.message || 'Login failed.');
      (error as any).response = response;
      (error as any).data = data;
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error("Error during logout API call:", error);
    } finally {
      // Clear state regardless of API call success
      setUser(null);
      setIsAuthenticated(false);
      router.replace('/login');
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Initializing App...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
