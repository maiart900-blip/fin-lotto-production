'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Users, RefreshCw, Search, Plus, Edit, Eye, 
  Phone, MessageSquare, DollarSign, TrendingUp,
  Wifi, WifiOff, UserPlus
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useBranchRealtime } from '@/hooks/use-branch-realtime';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  line_id: string | null;
  credit_balance: number;
  total_bets: number;
  total_wins: number;
  is_active: boolean;
  created_at: string;
  last_bet_at: string | null;
}

export default function ManualKeyCustomersPage() {
  const { branchId, isMasterBranch } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', line_id: '' });
  const [isSaving, setIsSaving] = useState(false);
  
  // View/Edit dialogs
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState({ name: '', phone: '', line_id: '', is_active: true });

  // Realtime sync
  const { isConnected, connectionQuality } = useBranchRealtime({
    branchId: branchId || null,
    onRealtimeEvent: () => {
      fetchCustomers();
    },
  });

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Query customers with source_type = 'manual_key' only
      let query = supabase
        .from('customers')
        .select('*')
        .eq('source_type', 'manual_key') // Filter for manual_key customers only
        .order('created_at', { ascending: false });

      if (!isMasterBranch && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[v0] Error fetching manual-key customers:', error);
        return;
      }

      console.log('[v0] Manual-key customers fetched:', data?.length);
      setCustomers(data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[v0] Fetch customers error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, isMasterBranch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('manual-key-customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchCustomers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCustomers]);

  // View customer
  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditCustomer({
      name: customer.name,
      phone: customer.phone || '',
      line_id: customer.line_id || '',
      is_active: customer.is_active,
    });
    setIsEditDialogOpen(true);
  };

  // Update customer
  const handleUpdateCustomer = async () => {
    if (!selectedCustomer || !editCustomer.name.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า');
      return;
    }

    try {
      setIsSaving(true);
      const supabase = createClient();

      const { error } = await supabase
        .from('customers')
        .update({
          name: editCustomer.name.trim(),
          phone: editCustomer.phone.trim() || null,
          line_id: editCustomer.line_id.trim() || null,
          is_active: editCustomer.is_active,
        })
        .eq('id', selectedCustomer.id);

      if (error) throw error;

      toast.success('บันทึกข้อมูลสำเร็จ');
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error('Update customer error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  // Add new customer with source_type = 'manual_key'
  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า');
      return;
    }

    try {
      setIsSaving(true);
      const supabase = createClient();

      // Get current user info from localStorage for owner_id and created_by
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;

      const insertData = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || null,
        line_id: newCustomer.line_id.trim() || null,
        branch_id: branchId,
        credit_balance: 0,
        total_bets: 0,
        total_wins: 0,
        is_active: true,
        source_type: 'manual_key', // Important: mark as manual_key customer
        system_type: 'manual_key',
        agent_id: currentUser?.id || null, // The agent who created this customer
        created_by: currentUser?.id || null,
      };

      console.log('[v0] Creating manual-key customer:', insertData);

      const { data, error } = await supabase.from('customers').insert(insertData).select().single();

      if (error) throw error;

      console.log('[v0] Manual-key customer created:', data);
      toast.success('เพิ่มลูกค้าคีย์หวยสำเร็จ');
      setNewCustomer({ name: '', phone: '', line_id: '' });
      setIsAddDialogOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error('[v0] Add customer error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(search) ||
      customer.phone?.includes(search) ||
      customer.line_id?.toLowerCase().includes(search)
    );
  });

  // Stats
  const stats = {
    total: customers.length,
    active: customers.filter(c => c.is_active).length,
    totalBets: customers.reduce((sum, c) => sum + (c.total_bets || 0), 0),
    totalWins: customers.reduce((sum, c) => sum + (c.total_wins || 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="size-6 text-amber-400" />
            ลูกค้าคีย์หวย
          </h1>
          <p className="text-white/60 mt-1">
            รายชื่อลูกค้าที่ใช้ระบบ Manual Key
            {isMasterBranch && <span className="text-amber-400 ml-2">(ดูได้ทุกสาขา)</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              <Wifi className="size-3 mr-1" />
              เชื่อมต่อ {connectionQuality !== 'good' && `(${connectionQuality})`}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
              <WifiOff className="size-3 mr-1" />
              ไม่เชื่อมต่อ
            </Badge>
          )}

          <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                <Plus className="size-4 mr-2" />
                เพิ่มลูกค้า
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0D1321] border-amber-500/30">
              <DialogHeader>
                <DialogTitle className="text-amber-400 flex items-center gap-2">
                  <UserPlus className="size-5" />
                  เพิ่มลูกค้าคีย์หวยใหม่
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-white">ชื่อลูกค้า *</Label>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="กรอกชื่อลูกค้า"
                    className="mt-1 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <Label className="text-white">เบอร์โทร</Label>
                  <Input
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="08x-xxx-xxxx"
                    className="mt-1 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <Label className="text-white">Line ID</Label>
                  <Input
                    value={newCustomer.line_id}
                    onChange={(e) => setNewCustomer({ ...newCustomer, line_id: e.target.value })}
                    placeholder="@lineid"
                    className="mt-1 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400 focus:ring-amber-500/20"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
                    ยกเลิก
                  </Button>
                  <Button 
                    onClick={handleAddCustomer} 
                    disabled={isSaving}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
                  >
                    {isSaving ? <RefreshCw className="size-4 animate-spin" /> : 'เพิ่มลูกค้า'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#0D1321] border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ลูกค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-amber-400">{stats.total}</p>
              </div>
              <Users className="size-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ใช้งานอยู่</p>
                <p className="text-2xl font-bold text-green-400">{stats.active}</p>
              </div>
              <TrendingUp className="size-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ยอดแทงรวม</p>
                <p className="text-2xl font-bold text-blue-400">{stats.totalBets.toLocaleString()}</p>
              </div>
              <DollarSign className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ยอดถูกรางวัล</p>
                <p className="text-2xl font-bold text-purple-400">{stats.totalWins.toLocaleString()}</p>
              </div>
              <DollarSign className="size-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
            <Input
              placeholder="ค้นหาชื่อ, เบอร์โทร, Line ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="size-5" />
              รายชื่อลูกค้า ({filteredCustomers.length})
            </span>
            <span className="text-sm text-white/40 font-normal">
              อัพเดท: {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: th })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-white/60">
              <RefreshCw className="size-8 animate-spin mx-auto mb-2" />
              กำลังโหลด...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              {customers.length === 0 ? 'ยังไม่มีลูกค้าคีย์หวย กดปุ่ม "เพิ่มลูกค้า" เพื่อเริ่มต้น' : 'ไม่พบลูกค้าที่ค้นหา'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1a1f2e]">
                  <tr className="text-left text-white/60 text-sm">
                    <th className="p-4">ชื่อ</th>
                    <th className="p-4">ติดต่อ</th>
                    <th className="p-4">ยอดแทง</th>
                    <th className="p-4">ยอดถูก</th>
                    <th className="p-4">เครดิต</th>
                    <th className="p-4">สถานะ</th>
                    <th className="p-4">แทงล่าสุด</th>
                    <th className="p-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <span className="font-medium text-white">{customer.name}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {customer.phone && (
                            <span className="text-white/80 flex items-center gap-1 text-sm">
                              <Phone className="size-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.line_id && (
                            <span className="text-green-400 flex items-center gap-1 text-sm">
                              <MessageSquare className="size-3" />
                              {customer.line_id}
                            </span>
                          )}
                          {!customer.phone && !customer.line_id && (
                            <span className="text-white/40 text-sm">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-blue-400 font-medium">
                        {(customer.total_bets || 0).toLocaleString()} บ.
                      </td>
                      <td className="p-4 text-green-400 font-medium">
                        {(customer.total_wins || 0).toLocaleString()} บ.
                      </td>
                      <td className="p-4 text-amber-400 font-medium">
                        {(customer.credit_balance || 0).toLocaleString()} บ.
                      </td>
                      <td className="p-4">
                        {customer.is_active ? (
                          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                            ใช้งาน
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                            ระงับ
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-white/60 text-sm">
                        {customer.last_bet_at 
                          ? formatDistanceToNow(new Date(customer.last_bet_at), { addSuffix: true, locale: th })
                          : '-'
                        }
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-white/60 hover:text-white"
                            onClick={() => handleViewCustomer(customer)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-amber-400 hover:text-amber-300"
                            onClick={() => handleOpenEditDialog(customer)}
                          >
                            <Edit className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Customer Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-[#0D1321] border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Eye className="size-5" />
              รายละเอียดลูกค้า
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/60 text-sm">ชื่อลูกค้า</Label>
                  <p className="text-white font-medium mt-1">{selectedCustomer.name}</p>
                </div>
                <div>
                  <Label className="text-white/60 text-sm">สถานะ</Label>
                  <div className="mt-1">
                    {selectedCustomer.is_active ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ใช้งาน</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">ระงับ</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-white/60 text-sm">เบอร์โทร</Label>
                  <p className="text-white mt-1 flex items-center gap-1">
                    <Phone className="size-4 text-white/60" />
                    {selectedCustomer.phone || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-white/60 text-sm">Line ID</Label>
                  <p className="text-green-400 mt-1 flex items-center gap-1">
                    <MessageSquare className="size-4" />
                    {selectedCustomer.line_id || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-white/60 text-sm">ยอดแทงรวม</Label>
                  <p className="text-blue-400 font-medium mt-1">
                    {(selectedCustomer.total_bets || 0).toLocaleString()} บาท
                  </p>
                </div>
                <div>
                  <Label className="text-white/60 text-sm">ยอดถูกรางวัล</Label>
                  <p className="text-green-400 font-medium mt-1">
                    {(selectedCustomer.total_wins || 0).toLocaleString()} บาท
                  </p>
                </div>
                <div>
                  <Label className="text-white/60 text-sm">เครดิตคงเหลือ</Label>
                  <p className="text-amber-400 font-medium mt-1">
                    {(selectedCustomer.credit_balance || 0).toLocaleString()} บาท
                  </p>
                </div>
                <div>
                  <Label className="text-white/60 text-sm">แทงล่าสุด</Label>
                  <p className="text-white/80 mt-1">
                    {selectedCustomer.last_bet_at 
                      ? formatDistanceToNow(new Date(selectedCustomer.last_bet_at), { addSuffix: true, locale: th })
                      : '-'
                    }
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t border-white/10">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="flex-1">
                  ปิด
                </Button>
                <Button 
                  onClick={() => {
                    setIsViewDialogOpen(false);
                    handleOpenEditDialog(selectedCustomer);
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
                >
                  <Edit className="size-4 mr-2" />
                  แก้ไข
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-[#0D1321] border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Edit className="size-5" />
              แก้ไขข้อมูลลูกค้า
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-white">ชื่อลูกค้า *</Label>
              <Input
                value={editCustomer.name}
                onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                placeholder="กรอกชื่อลูกค้า"
                className="mt-1 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <Label className="text-white">เบอร์โทร</Label>
              <Input
                value={editCustomer.phone}
                onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                placeholder="08x-xxx-xxxx"
                className="mt-1 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <Label className="text-white">Line ID</Label>
              <Input
                value={editCustomer.line_id}
                onChange={(e) => setEditCustomer({ ...editCustomer, line_id: e.target.value })}
                placeholder="@lineid"
                className="mt-1 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400 focus:ring-amber-500/20"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1f2e]">
              <div>
                <Label className="text-white">สถานะการใช้งาน</Label>
                <p className="text-white/60 text-sm">เปิด/ปิด การใช้งานลูกค้ารายนี้</p>
              </div>
              <Switch
                checked={editCustomer.is_active}
                onCheckedChange={(checked) => setEditCustomer({ ...editCustomer, is_active: checked })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                ยกเลิก
              </Button>
              <Button 
                onClick={handleUpdateCustomer} 
                disabled={isSaving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
              >
                {isSaving ? <RefreshCw className="size-4 animate-spin" /> : 'บันทึก'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
