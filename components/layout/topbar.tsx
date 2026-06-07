'use client';

import { toast } from 'sonner';
import useSWR from 'swr';
import Link from 'next/link';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEntries } from '@/hooks/use-lottery';
import { useAuth } from '@/hooks/use-auth';
import { Crown, LogOut, ShieldCheck, User, RefreshCw, Bell, CreditCard, ArrowDownToLine, AlertTriangle, UserPlus, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PendingCounts {
  topupPending: number;
  withdrawPending: number;
  newCustomersToday: number;
  newEntriesToday: number;
  depositIssuesPending: number;
  totalPending: number;
}

export function Topbar() {
  const { entries, mutate, isLoading } = useEntries();
  const { user, logout } = useAuth();
  
  // Fetch pending counts with auto-refresh every 5 seconds
  const { data: pendingCounts } = useSWR<PendingCounts>(
    '/api/admin/pending-counts',
    fetcher,
    { refreshInterval: 5000 }
  );

  const isAdmin = user?.role === 'admin';
  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  const todayEntries = entries.filter(e => 
    e.created_at.startsWith(new Date().toISOString().split('T')[0])
  );
  const todayTotal = todayEntries.reduce((sum, e) => sum + e.amount, 0);

  const handleLogout = async () => {
    await logout();
    toast.success('ออกจากระบบสำเร็จ');
  };

  const handleRefresh = () => {
    mutate();
    toast.success('รีเฟรชข้อมูลแล้ว');
  };

  // ===================================================================
  // HEADER (Topbar) — แถบบนสุดแบบ sticky ที่แสดงในทุกหน้าของหลังบ้าน
  // -------------------------------------------------------------------
  // โครงสร้างจากซ้ายไปขวา:
  //  1) SidebarTrigger : ปุ่มยุบ/ขยายเมนูด้านซ้าย
  //  2) Mobile Logo    : โลโก้ "FIN LOTTO R+" (แสดงเฉพาะจอมือถือ)
  //  3) Spacer         : <div flex-1> ดันกลุ่มเครื่องมือไปชิดขวา
  //  4) Action Group   : กระดิ่งแจ้งเตือน, ปุ่มรีเฟรช, ยอดวันนี้,
  //                      ข้อมูลผู้ใช้, ปุ่มออกจากระบบ
  // ===================================================================
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-[rgba(234,179,8,0.1)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 shadow-sm">
      {/* 1) ปุ่มยุบ/ขยาย Sidebar */}
      <SidebarTrigger className="text-[#64748B] hover:text-[#EAB308]" />
      
      {/* 2) โลโก้สำหรับจอมือถือ (ซ่อนบนจอ desktop ด้วย md:hidden) */}
      <div className="flex items-center gap-2 md:hidden">
        <Crown className="size-5 text-[#EAB308]" />
        <span className="font-bold text-sm bg-gradient-to-r from-[#EAB308] to-[#B8860B] bg-clip-text text-transparent">
          FIN LOTTO R+
        </span>
      </div>

      {/* 3) Spacer: ดันกลุ่มเครื่องมือด้านขวาให้ชิดขอบขวา */}
      <div className="flex-1" />
      
      {/* 4) Action Group: กลุ่มเครื่องมือด้านขวาของ Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 4.1) กระดิ่งแจ้งเตือน — แสดง badge จำนวนรายการรอดำเนินการ */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-[#64748B] hover:text-[#EAB308] hover:bg-[rgba(234,179,8,0.1)]">
              <Bell className="size-4" />
              {(pendingCounts?.totalPending || 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[10px] text-white font-bold shadow-lg shadow-[rgba(234,179,8,0.4)]">
                  {pendingCounts!.totalPending > 9 ? '9+' : pendingCounts!.totalPending}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Bell className="size-4" />
              รายการรอดำเนินการ
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pendingCounts?.topupPending ? (
              <DropdownMenuItem asChild>
                <Link href="/topup-requests" className="flex justify-between cursor-pointer">
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4 text-amber-500" />
                    คำขอเติมเงิน
                  </span>
                  <Badge variant="destructive">{pendingCounts.topupPending}</Badge>
                </Link>
              </DropdownMenuItem>
            ) : null}
            {pendingCounts?.withdrawPending ? (
              <DropdownMenuItem asChild>
                <Link href="/withdraw-requests" className="flex justify-between cursor-pointer">
                  <span className="flex items-center gap-2">
                    <ArrowDownToLine className="size-4 text-red-500" />
                    คำขอถอนเงิน
                  </span>
                  <Badge variant="destructive">{pendingCounts.withdrawPending}</Badge>
                </Link>
              </DropdownMenuItem>
            ) : null}
            {pendingCounts?.depositIssuesPending ? (
              <DropdownMenuItem asChild>
                <Link href="/deposit-issues" className="flex justify-between cursor-pointer">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-orange-500" />
                    แจ้งปัญหาฝากเงิน
                  </span>
                  <Badge variant="destructive">{pendingCounts.depositIssuesPending}</Badge>
                </Link>
              </DropdownMenuItem>
            ) : null}
            {pendingCounts?.newCustomersToday ? (
              <DropdownMenuItem asChild>
                <Link href="/customers" className="flex justify-between cursor-pointer">
                  <span className="flex items-center gap-2">
                    <UserPlus className="size-4 text-blue-500" />
                    สมาชิกใหม่วันนี้
                  </span>
                  <Badge variant="secondary">{pendingCounts.newCustomersToday}</Badge>
                </Link>
              </DropdownMenuItem>
            ) : null}
            {pendingCounts?.newEntriesToday ? (
              <DropdownMenuItem asChild>
                <Link href="/entries" className="flex justify-between cursor-pointer">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-green-500" />
                    รายการใหม่วันนี้
                  </span>
                  <Badge variant="secondary">{pendingCounts.newEntriesToday}</Badge>
                </Link>
              </DropdownMenuItem>
            ) : null}
            {!pendingCounts?.totalPending && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                ไม่มีรายการรอดำเนินการ
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 4.2) ปุ่มรีเฟรชข้อมูล — ดึงรายการเดิมพันใหม่ */}
        <Button
          variant="ghost"
          size="icon"
          className="text-[#64748B] hover:text-[#EAB308] hover:bg-[rgba(234,179,8,0.1)]"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        {/* 4.3) ยอดเดิมพันวันนี้ — ซ่อนบนจอมือถือขนาดเล็ก */}
        <div className="hidden xs:flex items-center gap-2">
          <Badge className="text-xs bg-gradient-to-b from-[#EAB308] to-[#B8860B] text-white font-semibold border-0 shadow-lg shadow-[rgba(234,179,8,0.3)]">
            วันนี้: {todayTotal.toLocaleString()}
          </Badge>
        </div>

        {/* 4.4) ข้อมูลผู้ใช้ — แสดงไอคอนตามสิทธิ์ (admin/ทั่วไป) + ชื่อ */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.2)]">
          {isAdmin ? (
            <ShieldCheck className="size-4 text-[#EAB308]" />
          ) : (
            <User className="size-4 text-[#64748B]" />
          )}
          <span className="hidden sm:inline text-sm font-medium text-[#0F172A]">
            {user?.displayName || 'User'}
          </span>
        </div>

        {/* 4.5) ปุ่มออกจากระบบ — เคลียร์ session แล้วกลับไปหน้า login */}
        <Button
          variant="ghost"
          size="icon"
          className="text-[#64748B] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)]"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
