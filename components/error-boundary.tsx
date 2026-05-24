'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[v0] Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white border-[rgba(234,179,8,0.3)] shadow-lg">
            <CardContent className="pt-8 pb-6 text-center space-y-6">
              {/* Logo */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B]">
                  <Crown className="size-6 text-white" />
                </div>
                <span className="text-xl font-bold text-[#B8860B]">FIN LOTTO R+</span>
              </div>

              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-[#FEF3C7]">
                  <AlertTriangle className="size-12 text-[#B8860B]" />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-[#0F172A]">เกิดข้อผิดพลาด</h2>
                <p className="text-[#64748B] text-sm">
                  ระบบพบข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="border-[#EAB308] text-[#B8860B] hover:bg-[rgba(234,179,8,0.1)]"
                >
                  <Home className="size-4 mr-2" />
                  กลับหน้าหลัก
                </Button>
                <Button
                  onClick={this.handleRetry}
                  className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-white hover:from-[#B8860B] hover:to-[#996F0A]"
                >
                  <RefreshCw className="size-4 mr-2" />
                  ลองใหม่
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Fallback component for loading states
export function LoadingFallback({ message = 'กำลังโหลด...' }: { message?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="size-16 border-4 border-[#EAB308]/20 rounded-full animate-pulse" />
          <div className="absolute inset-0 size-16 border-4 border-transparent border-t-[#EAB308] rounded-full animate-spin" />
        </div>
        <p className="text-[#64748B] text-sm">{message}</p>
      </div>
    </div>
  );
}

// Empty state component
export function EmptyState({ 
  title = 'ไม่พบข้อมูล',
  description = 'ยังไม่มีข้อมูลในขณะนี้',
  action,
  actionLabel = 'เพิ่มข้อมูล',
}: {
  title?: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="p-4 rounded-full bg-[#F1F5F9] mx-auto w-fit">
          <Crown className="size-8 text-[#94A3B8]" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-[#0F172A]">{title}</h3>
          <p className="text-[#64748B] text-sm">{description}</p>
        </div>
        {action && (
          <Button
            onClick={action}
            className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-white"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// Safe wrapper for async data
export function SafeDataDisplay<T>({
  data,
  isLoading,
  error,
  render,
  loadingMessage = 'กำลังโหลดข้อมูล...',
  emptyTitle = 'ไม่พบข้อมูล',
  emptyDescription = 'ยังไม่มีข้อมูลในขณะนี้',
}: {
  data: T | null | undefined;
  isLoading: boolean;
  error?: Error | null;
  render: (data: T) => ReactNode;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (isLoading) {
    return <LoadingFallback message={loadingMessage} />;
  }

  if (error) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertTriangle className="size-8 text-[#EAB308] mx-auto" />
          <p className="text-[#64748B] text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        </div>
      </div>
    );
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return <>{render(data)}</>;
}
