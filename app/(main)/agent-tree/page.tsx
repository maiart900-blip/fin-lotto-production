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
  Users,
  Crown,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  TrendingUp,
  Wallet,
  Network,
  Eye,
  Building2,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  display_name: string;
  role: string;
  referral_code: string;
  referred_by: string | null;
  parent_agent_id: string | null;
  hierarchy_level: number;
  commission_percent: number;
  share_percent: number;
  credit_balance: number;
  is_partner: boolean;
  created_at: string;
  children?: User[];
  level?: number;
}

interface Stats {
  totalAgents: number;
  totalMembers: number;
  totalUsers: number;
  activePartners: number;
}

export default function AgentTreePage() {
  const [tree, setTree] = useState<User[]>([]);
  const [flatList, setFlatList] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');

  useEffect(() => {
    fetchAgentTree();
  }, []);

  const fetchAgentTree = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent-tree');
      const data = await res.json();
      if (data.success) {
        setTree(data.tree || []);
        setFlatList(data.flatList || []);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching agent tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.6)]" />;
      case 'admin':
        return <ShieldCheck className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />;
      case 'agent':
      case 'partner':
        return <Building2 className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]" />;
      default:
        return <UserCheck className="size-4 text-[#888888]" />;
    }
  };

  const getRoleBadge = (role: string, isPartner: boolean) => {
    const roleConfig: Record<string, { label: string; className: string }> = {
      super_admin: { label: 'Super Admin', className: 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black' },
      admin: { label: 'Admin', className: 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' },
      agent: { label: 'Agent', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
      partner: { label: 'Partner', className: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
      member: { label: 'Member', className: 'bg-[#2a2a2a] text-[#888888] border border-[#3a3a3a]' },
    };

    const config = roleConfig[role] || roleConfig.member;
    
    return (
      <div className="flex items-center gap-1">
        <Badge className={`${config.className} text-xs`}>
          {config.label}
        </Badge>
        {isPartner && role !== 'partner' && (
          <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs">
            Partner
          </Badge>
        )}
      </div>
    );
  };

  const countChildren = (node: User): number => {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.length + node.children.reduce((sum, child) => sum + countChildren(child), 0);
  };

  const renderTreeNode = (node: User, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const childCount = countChildren(node);

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all
            ${selectedAgent?.id === node.id 
              ? 'bg-[rgba(212,175,55,0.15)] border border-[#D4AF37]/30' 
              : 'hover:bg-[rgba(212,175,55,0.08)] border border-transparent'
            }`}
          style={{ marginLeft: `${depth * 24}px` }}
          onClick={() => setSelectedAgent(node)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="p-1 hover:bg-[rgba(212,175,55,0.1)] rounded"
            >
              {isExpanded ? (
                <ChevronDown className="size-4 text-[#D4AF37]" />
              ) : (
                <ChevronRight className="size-4 text-[#D4AF37]" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Role Icon */}
          {getRoleIcon(node.role)}

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#E5E5E5] truncate">
                {node.display_name || node.username}
              </span>
              {getRoleBadge(node.role, node.is_partner)}
            </div>
            <div className="flex items-center gap-3 text-xs text-[#888888]">
              <span>{node.username}</span>
              {node.referral_code && (
                <span className="text-[#D4AF37]">รหัส: {node.referral_code}</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            {childCount > 0 && (
              <div className="flex items-center gap-1 text-[#888888]">
                <Users className="size-3" />
                <span>{childCount}</span>
              </div>
            )}
            <div className="text-right">
              <div className="text-[#D4AF37] font-medium">
                {node.commission_percent}%
              </div>
              <div className="text-xs text-[#888888]">คอม</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)]"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAgent(node);
              }}
            >
              <Eye className="size-4" />
            </Button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l border-[rgba(212,175,55,0.2)] ml-4">
            {node.children?.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredList = flatList.filter(user =>
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#E5E5E5] flex items-center gap-3">
            <Network className="size-7 text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
            โครงสร้างสายงาน
          </h1>
          <p className="text-[#888888] mt-1">ระบบจัดการเอเย่นต์และลูกข่ายแบบ Multi-Level</p>
        </div>
        <Button
          onClick={fetchAgentTree}
          disabled={loading}
          className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black hover:from-[#F5D061] hover:to-[#D4AF37]"
        >
          <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-[#B8860B]/10">
                <Crown className="size-5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-xs text-[#888888]">เอเย่นต์ทั้งหมด</p>
                <p className="text-xl font-bold text-[#D4AF37]">{stats?.totalAgents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10">
                <Users className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-[#888888]">สมาชิกทั้งหมด</p>
                <p className="text-xl font-bold text-blue-400">{stats?.totalMembers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/10">
                <TrendingUp className="size-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-[#888888]">พาร์ทเนอร์</p>
                <p className="text-xl font-bold text-green-400">{stats?.activePartners || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10">
                <Wallet className="size-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-[#888888]">ผู้ใช้ทั้งหมด</p>
                <p className="text-xl font-bold text-purple-400">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Tree */}
        <div className="lg:col-span-2">
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[#E5E5E5] flex items-center gap-2">
                  <Network className="size-5 text-[#D4AF37]" />
                  แผนผังสายงาน
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'tree' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('tree')}
                    className={viewMode === 'tree' 
                      ? 'bg-[#D4AF37] text-black' 
                      : 'border-[rgba(212,175,55,0.3)] text-[#D4AF37]'
                    }
                  >
                    Tree
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className={viewMode === 'table' 
                      ? 'bg-[#D4AF37] text-black' 
                      : 'border-[rgba(212,175,55,0.3)] text-[#D4AF37]'
                    }
                  >
                    Table
                  </Button>
                </div>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#888888]" />
                <Input
                  placeholder="ค้นหาชื่อ, เบอร์โทร, รหัสแนะนำ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-[#121212] border-[rgba(212,175,55,0.2)] text-[#E5E5E5] placeholder:text-[#555555]"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="size-8 text-[#D4AF37] animate-spin" />
                </div>
              ) : viewMode === 'tree' ? (
                <div className="space-y-1">
                  {tree.length > 0 ? (
                    tree.map(node => renderTreeNode(node))
                  ) : (
                    <p className="text-center text-[#888888] py-8">ไม่พบข้อมูลสายงาน</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[rgba(212,175,55,0.1)]">
                      <TableHead className="text-[#D4AF37]">ชื่อ/เบอร์โทร</TableHead>
                      <TableHead className="text-[#D4AF37]">ตำแหน่ง</TableHead>
                      <TableHead className="text-[#D4AF37]">รหัสแนะนำ</TableHead>
                      <TableHead className="text-[#D4AF37]">ค่าคอม</TableHead>
                      <TableHead className="text-[#D4AF37]">Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredList.map(user => (
                      <TableRow 
                        key={user.id} 
                        className="border-[rgba(212,175,55,0.1)] cursor-pointer hover:bg-[rgba(212,175,55,0.05)]"
                        onClick={() => setSelectedAgent(user)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-[#E5E5E5]">{user.display_name}</p>
                            <p className="text-xs text-[#888888]">{user.username}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role, user.is_partner)}</TableCell>
                        <TableCell className="text-[#D4AF37]">{user.referral_code || '-'}</TableCell>
                        <TableCell>{user.commission_percent}%</TableCell>
                        <TableCell>{user.hierarchy_level}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Agent Detail */}
        <div>
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)] sticky top-6">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)]">
              <CardTitle className="text-[#E5E5E5] flex items-center gap-2">
                <Eye className="size-5 text-[#D4AF37]" />
                รายละเอียด
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedAgent ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121212]">
                    <div className="p-2 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B]">
                      {getRoleIcon(selectedAgent.role)}
                    </div>
                    <div>
                      <p className="font-bold text-[#E5E5E5]">{selectedAgent.display_name}</p>
                      <p className="text-sm text-[#888888]">{selectedAgent.username}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[#121212]">
                      <p className="text-xs text-[#888888]">ตำแหน่ง</p>
                      <div className="mt-1">{getRoleBadge(selectedAgent.role, selectedAgent.is_partner)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#121212]">
                      <p className="text-xs text-[#888888]">Hierarchy Level</p>
                      <p className="text-lg font-bold text-[#D4AF37]">{selectedAgent.hierarchy_level}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#121212]">
                      <p className="text-xs text-[#888888]">ค่าคอมมิชชั่น</p>
                      <p className="text-lg font-bold text-[#D4AF37]">{selectedAgent.commission_percent}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#121212]">
                      <p className="text-xs text-[#888888]">ส่วนแบ่ง PT</p>
                      <p className="text-lg font-bold text-green-400">{selectedAgent.share_percent}%</p>
                    </div>
                  </div>

                  {selectedAgent.referral_code && (
                    <div className="p-3 rounded-lg bg-[#121212]">
                      <p className="text-xs text-[#888888]">รหัสแนะนำ</p>
                      <p className="text-lg font-bold text-[#D4AF37]">{selectedAgent.referral_code}</p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-[#121212]">
                    <p className="text-xs text-[#888888]">ยอดเครดิต</p>
                    <p className="text-lg font-bold text-[#D4AF37]">
                      {selectedAgent.credit_balance?.toLocaleString()} บาท
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#121212]">
                    <p className="text-xs text-[#888888]">สมัครเมื่อ</p>
                    <p className="text-sm text-[#E5E5E5]">
                      {new Date(selectedAgent.created_at).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[#888888]">
                  <Users className="size-12 mx-auto mb-3 opacity-50" />
                  <p>เลือกสมาชิกเพื่อดูรายละเอียด</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
