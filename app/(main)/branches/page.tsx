'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Plus,
  Search,
  Globe,
  Settings,
  DollarSign,
  Users,
  RefreshCw,
  ExternalLink,
  Edit,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface Branch {
  id: string;
  code: string;
  name: string;
  branch_type: string;
  is_master: boolean;
  is_active: boolean;
  created_at: string;
  branch_settings?: {
    site_name: string;
    logo_url: string;
    primary_color: string;
  };
  branch_finance?: {
    credit_balance: number;
    credit_limit: number;
    revenue_share_percent: number;
  };
  branch_domains?: {
    domain: string;
    is_primary: boolean;
  }[];
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({
    code: '',
    name: '',
    branch_type: 'branch',
    settings: {
      site_name: '',
      primary_color: '#f59e0b',
    },
    finance: {
      credit_limit: 100000,
      revenue_share_percent: 30,
    },
  });

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('branch_type', typeFilter);

      const res = await fetch(`/api/admin/branches?${params}`);
      const data = await res.json();
      setBranches(data.branches || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [search, typeFilter]);

  const handleCreateBranch = async () => {
    try {
      const res = await fetch('/api/admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBranch),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setNewBranch({
          code: '',
          name: '',
          branch_type: 'branch',
          settings: { site_name: '', primary_color: '#f59e0b' },
          finance: { credit_limit: 100000, revenue_share_percent: 30 },
        });
        fetchBranches();
      }
    } catch (error) {
      console.error('Error creating branch:', error);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!confirm('ยืนยันการลบสาขานี้?')) return;

    try {
      const res = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchBranches();
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
    }
  };

  const getBranchTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      master: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      branch: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      franchise: 'bg-green-500/20 text-green-400 border-green-500/30',
      white_label: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    const labels: Record<string, string> = {
      master: 'Master',
      branch: 'สาขา',
      franchise: 'แฟรนไชส์',
      white_label: 'White Label',
    };
    return (
      <Badge variant="outline" className={styles[type] || styles.branch}>
        {labels[type] || type}
      </Badge>
    );
  };

  // Summary stats
  const stats = {
    total: branches.length,
    active: branches.filter(b => b.is_active).length,
    franchise: branches.filter(b => b.branch_type === 'franchise').length,
    whiteLabel: branches.filter(b => b.branch_type === 'white_label').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">สาขา / White Label</h1>
          <p className="text-zinc-400">จัดการสาขา, แฟรนไชส์, และเว็บ White Label</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-black">
              <Plus className="h-4 w-4 mr-2" />
              สร้างสาขาใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">สร้างสาขาใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">รหัสสาขา</Label>
                  <Input
                    value={newBranch.code}
                    onChange={e => setNewBranch({ ...newBranch, code: e.target.value })}
                    placeholder="BRANCH001"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">ประเภท</Label>
                  <Select
                    value={newBranch.branch_type}
                    onValueChange={v => setNewBranch({ ...newBranch, branch_type: v })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="branch">สาขา</SelectItem>
                      <SelectItem value="franchise">แฟรนไชส์</SelectItem>
                      <SelectItem value="white_label">White Label</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">ชื่อสาขา</Label>
                <Input
                  value={newBranch.name}
                  onChange={e => setNewBranch({ ...newBranch, name: e.target.value })}
                  placeholder="สาขากรุงเทพฯ"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">วงเงินเครดิต</Label>
                  <Input
                    type="number"
                    value={newBranch.finance.credit_limit}
                    onChange={e =>
                      setNewBranch({
                        ...newBranch,
                        finance: { ...newBranch.finance, credit_limit: Number(e.target.value) },
                      })
                    }
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">ส่วนแบ่งรายได้ (%)</Label>
                  <Input
                    type="number"
                    value={newBranch.finance.revenue_share_percent}
                    onChange={e =>
                      setNewBranch({
                        ...newBranch,
                        finance: { ...newBranch.finance, revenue_share_percent: Number(e.target.value) },
                      })
                    }
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateBranch}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black"
                disabled={!newBranch.code || !newBranch.name}
              >
                สร้างสาขา
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-zinc-400">สาขาทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Users className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.active}</p>
                <p className="text-xs text-zinc-400">เปิดใช้งาน</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Globe className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.franchise}</p>
                <p className="text-xs text-zinc-400">แฟรนไชส์</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Settings className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.whiteLabel}</p>
                <p className="text-xs text-zinc-400">White Label</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาสาขา..."
                className="pl-9 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="branch">สาขา</SelectItem>
                <SelectItem value="franchise">แฟรนไชส์</SelectItem>
                <SelectItem value="white_label">White Label</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={fetchBranches}
              className="border-zinc-700 text-zinc-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">รายการสาขา</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-zinc-400">กำลังโหลด...</div>
          ) : branches.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">ไม่พบข้อมูลสาขา</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">รหัส</TableHead>
                  <TableHead className="text-zinc-400">ชื่อสาขา</TableHead>
                  <TableHead className="text-zinc-400">ประเภท</TableHead>
                  <TableHead className="text-zinc-400">โดเมน</TableHead>
                  <TableHead className="text-zinc-400 text-right">วงเงิน</TableHead>
                  <TableHead className="text-zinc-400 text-right">ส่วนแบ่ง</TableHead>
                  <TableHead className="text-zinc-400">สถานะ</TableHead>
                  <TableHead className="text-zinc-400">สร้างเมื่อ</TableHead>
                  <TableHead className="text-zinc-400 text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map(branch => (
                  <TableRow key={branch.id} className="border-zinc-800">
                    <TableCell className="font-mono text-amber-400">{branch.code}</TableCell>
                    <TableCell className="text-white font-medium">{branch.name}</TableCell>
                    <TableCell>{getBranchTypeBadge(branch.branch_type)}</TableCell>
                    <TableCell>
                      {branch.branch_domains?.find(d => d.is_primary)?.domain ? (
                        <div className="flex items-center gap-1 text-zinc-400">
                          <Globe className="h-3 w-3" />
                          <span className="text-sm">
                            {branch.branch_domains.find(d => d.is_primary)?.domain}
                          </span>
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-white">
                      {branch.branch_finance?.credit_limit?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-right text-green-400">
                      {branch.branch_finance?.revenue_share_percent || 0}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          branch.is_active
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }
                      >
                        {branch.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {format(new Date(branch.created_at), 'dd MMM yy', { locale: th })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                          onClick={() => handleDeleteBranch(branch.id)}
                          disabled={branch.is_master}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
