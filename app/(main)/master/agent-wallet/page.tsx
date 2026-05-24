'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, Send, ArrowUpRight, ArrowDownRight, Search,
  RefreshCcw, AlertTriangle, Check, X, Ban, Play,
  TrendingUp, Users, CreditCard, Activity, Filter,
  ChevronDown, MoreVertical, History, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Agent {
  id: string;
  code: string;
  name: string;
  credit_balance: number;
  credit_limit: number;
  commission_rate: number;
  status: 'active' | 'inactive' | 'suspended';
  total_bets: number;
  total_payout: number;
  total_commission: number;
  last_activity_at: string;
}

interface TransferModalState {
  isOpen: boolean;
  type: 'add' | 'deduct' | null;
  agent: Agent | null;
  amount: string;
  note: string;
}

interface StatusModalState {
  isOpen: boolean;
  agent: Agent | null;
  newStatus: 'active' | 'inactive' | 'suspended' | null;
}

export default function AgentWalletControlPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [transferModal, setTransferModal] = useState<TransferModalState>({
    isOpen: false,
    type: null,
    agent: null,
    amount: '',
    note: '',
  });
  const [statusModal, setStatusModal] = useState<StatusModalState>({
    isOpen: false,
    agent: null,
    newStatus: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch agents data
  const { data: agents = [], mutate, isLoading } = useSWR<Agent[]>(
    '/api/agents?include=stats',
    fetcher,
    { refreshInterval: 10000 }
  );

  // Fetch summary stats
  const { data: stats } = useSWR(
    '/api/agents/stats/summary',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = 
      agent.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalCredit = agents.reduce((sum, a) => sum + (a.credit_balance || 0), 0);
  const totalLimit = agents.reduce((sum, a) => sum + (a.credit_limit || 0), 0);
  const activeAgents = agents.filter(a => a.status === 'active').length;

  // Handle credit transfer
  const handleTransfer = async () => {
    if (!transferModal.agent || !transferModal.amount || !transferModal.type) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/agents/credit/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: transferModal.agent.id,
          type: transferModal.type,
          amount: parseFloat(transferModal.amount),
          note: transferModal.note,
        }),
      });

      if (response.ok) {
        mutate();
        setTransferModal({ isOpen: false, type: null, agent: null, amount: '', note: '' });
      }
    } catch (error) {
      console.error('Transfer error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle status change
  const handleStatusChange = async () => {
    if (!statusModal.agent || !statusModal.newStatus) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/agents/${statusModal.agent.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusModal.newStatus }),
      });

      if (response.ok) {
        mutate();
        setStatusModal({ isOpen: false, agent: null, newStatus: null });
      }
    } catch (error) {
      console.error('Status change error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const config = {
      active: { color: 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30', label: 'Active' },
      inactive: { color: 'bg-[#64748B]/20 text-[#64748B] border-[#64748B]/30', label: 'Inactive' },
      suspended: { color: 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30', label: 'Suspended' },
    }[status] || { color: 'bg-[#64748B]/20 text-[#64748B]', label: status };

    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', config.color)}>
        {config.label}
      </span>
    );
  };

  // Quick amounts for transfer
  const QUICK_AMOUNTS = [1000, 5000, 10000, 50000, 100000, 500000];

  return (
    <div className="min-h-screen live-midnight-canvas p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] flex items-center justify-center shadow-lg shadow-[#EAB308]/30">
              <Wallet className="size-6 text-[#0F172A]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F5E1A4]">Agent Wallet Control</h1>
              <p className="text-sm text-[#64748B]">Master Admin - Credit Distribution & Status Management</p>
            </div>
          </div>
          <Button
            onClick={() => mutate()}
            variant="outline"
            className="border-[#334155] text-[#94A3B8] hover:bg-[#1E293B]"
          >
            <RefreshCcw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ultra-glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <CreditCard className="size-5 text-[#EAB308]" />
              <TrendingUp className="size-4 text-[#22C55E]" />
            </div>
            <p className="text-sm text-[#64748B]">Total Credit Balance</p>
            <p className="text-2xl font-bold text-[#F5E1A4]">{totalCredit.toLocaleString()}</p>
          </div>

          <div className="ultra-glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <Wallet className="size-5 text-[#3B82F6]" />
              <span className="text-xs text-[#64748B]">Limit</span>
            </div>
            <p className="text-sm text-[#64748B]">Total Credit Limit</p>
            <p className="text-2xl font-bold text-[#3B82F6]">{totalLimit.toLocaleString()}</p>
          </div>

          <div className="ultra-glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <Users className="size-5 text-[#22C55E]" />
              <span className="text-xs text-[#22C55E]">Online</span>
            </div>
            <p className="text-sm text-[#64748B]">Active Agents</p>
            <p className="text-2xl font-bold text-[#22C55E]">{activeAgents} / {agents.length}</p>
          </div>

          <div className="ultra-glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <Activity className="size-5 text-[#F59E0B]" />
              <span className="text-xs text-[#64748B]">Today</span>
            </div>
            <p className="text-sm text-[#64748B]">Total Transactions</p>
            <p className="text-2xl font-bold text-[#F59E0B]">{stats?.todayTransactions || 0}</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-[#64748B]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code or name..."
              className="pl-10 bg-[#0F172A] border-[#334155] text-[#F1F5F9] placeholder:text-[#475569]"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-[#334155] text-[#94A3B8]">
                <Filter className="size-4 mr-2" />
                Status: {statusFilter === 'all' ? 'All' : statusFilter}
                <ChevronDown className="size-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1E293B] border-[#334155]">
              <DropdownMenuItem onClick={() => setStatusFilter('all')} className="text-[#F1F5F9]">
                All Agents
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('active')} className="text-[#22C55E]">
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('inactive')} className="text-[#64748B]">
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('suspended')} className="text-[#EF4444]">
                Suspended
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Agents Table */}
        <div className="ultra-glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="px-4 py-4 text-left text-sm font-medium text-[#94A3B8]">Agent</th>
                  <th className="px-4 py-4 text-right text-sm font-medium text-[#94A3B8]">Credit Balance</th>
                  <th className="px-4 py-4 text-right text-sm font-medium text-[#94A3B8]">Credit Limit</th>
                  <th className="px-4 py-4 text-right text-sm font-medium text-[#94A3B8]">Commission</th>
                  <th className="px-4 py-4 text-center text-sm font-medium text-[#94A3B8]">Status</th>
                  <th className="px-4 py-4 text-center text-sm font-medium text-[#94A3B8]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#64748B]">
                      <div className="flex items-center justify-center gap-2">
                        <div className="size-5 border-2 border-[#EAB308]/30 border-t-[#EAB308] rounded-full animate-spin" />
                        Loading agents...
                      </div>
                    </td>
                  </tr>
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#64748B]">
                      No agents found
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <tr key={agent.id} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-gradient-to-br from-[#334155] to-[#1E293B] flex items-center justify-center text-[#F5E1A4] font-bold">
                            {agent.code.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-[#F1F5F9]">{agent.name}</p>
                            <p className="text-sm text-[#64748B]">{agent.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className={cn(
                          'font-mono font-bold text-lg',
                          agent.credit_balance < 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'
                        )}>
                          {agent.credit_balance.toLocaleString()}
                        </p>
                        <div className="w-24 ml-auto mt-1 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#EAB308] to-[#22C55E]"
                            style={{ width: `${Math.min(100, (agent.credit_balance / agent.credit_limit) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-mono text-[#94A3B8]">{agent.credit_limit.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-[#F5E1A4]">{agent.commission_rate}%</p>
                        <p className="text-xs text-[#64748B]">
                          Total: {(agent.total_commission || 0).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={agent.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* Add Credit */}
                          <Button
                            size="sm"
                            onClick={() => setTransferModal({
                              isOpen: true,
                              type: 'add',
                              agent,
                              amount: '',
                              note: '',
                            })}
                            className="bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30 border border-[#22C55E]/30"
                          >
                            <ArrowUpRight className="size-4" />
                          </Button>
                          
                          {/* Deduct Credit */}
                          <Button
                            size="sm"
                            onClick={() => setTransferModal({
                              isOpen: true,
                              type: 'deduct',
                              agent,
                              amount: '',
                              note: '',
                            })}
                            className="bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30 border border-[#EF4444]/30"
                          >
                            <ArrowDownRight className="size-4" />
                          </Button>

                          {/* More Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-[#64748B] hover:text-[#F1F5F9]">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-[#1E293B] border-[#334155]">
                              <DropdownMenuItem className="text-[#F1F5F9]">
                                <History className="size-4 mr-2" />
                                View History
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[#F1F5F9]">
                                <Settings className="size-4 mr-2" />
                                Edit Settings
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[#334155]" />
                              {agent.status === 'active' ? (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => setStatusModal({ isOpen: true, agent, newStatus: 'inactive' })}
                                    className="text-[#F59E0B]"
                                  >
                                    <Ban className="size-4 mr-2" />
                                    Deactivate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => setStatusModal({ isOpen: true, agent, newStatus: 'suspended' })}
                                    className="text-[#EF4444]"
                                  >
                                    <X className="size-4 mr-2" />
                                    Suspend
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => setStatusModal({ isOpen: true, agent, newStatus: 'active' })}
                                  className="text-[#22C55E]"
                                >
                                  <Play className="size-4 mr-2" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Credit Transfer Modal */}
      <Dialog open={transferModal.isOpen} onOpenChange={(open) => !open && setTransferModal({ ...transferModal, isOpen: false })}>
        <DialogContent className="bg-[#0F172A] border-[#334155] text-[#F1F5F9] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#F5E1A4]">
              {transferModal.type === 'add' ? (
                <ArrowUpRight className="size-5 text-[#22C55E]" />
              ) : (
                <ArrowDownRight className="size-5 text-[#EF4444]" />
              )}
              {transferModal.type === 'add' ? 'Add Credit' : 'Deduct Credit'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Agent Info */}
            <div className="p-3 bg-[#1E293B] rounded-lg">
              <p className="text-sm text-[#64748B]">Agent</p>
              <p className="font-medium">{transferModal.agent?.name} ({transferModal.agent?.code})</p>
              <p className="text-sm text-[#64748B] mt-1">
                Current Balance: <span className="text-[#22C55E]">{transferModal.agent?.credit_balance.toLocaleString()}</span>
              </p>
            </div>

            {/* Quick Amounts */}
            <div>
              <p className="text-sm text-[#64748B] mb-2">Quick Amount</p>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map(amt => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setTransferModal(s => ({ ...s, amount: amt.toString() }))}
                    className={cn(
                      'border-[#334155]',
                      transferModal.amount === amt.toString() 
                        ? 'bg-[#EAB308] text-[#0F172A] border-[#EAB308]'
                        : 'text-[#94A3B8] hover:bg-[#1E293B]'
                    )}
                  >
                    {amt.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <p className="text-sm text-[#64748B] mb-2">Amount</p>
              <Input
                value={transferModal.amount}
                onChange={(e) => setTransferModal(s => ({ ...s, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                placeholder="Enter amount..."
                className="bg-[#1E293B] border-[#334155] text-[#F1F5F9] text-lg font-mono"
              />
            </div>

            {/* Note */}
            <div>
              <p className="text-sm text-[#64748B] mb-2">Note (Optional)</p>
              <Input
                value={transferModal.note}
                onChange={(e) => setTransferModal(s => ({ ...s, note: e.target.value }))}
                placeholder="Add a note..."
                className="bg-[#1E293B] border-[#334155] text-[#F1F5F9]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTransferModal({ isOpen: false, type: null, agent: null, amount: '', note: '' })}
              className="border-[#334155] text-[#94A3B8]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!transferModal.amount || isProcessing}
              className={cn(
                'min-w-[120px]',
                transferModal.type === 'add'
                  ? 'bg-[#22C55E] hover:bg-[#16A34A] text-white'
                  : 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
              )}
            >
              {isProcessing ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {transferModal.type === 'add' ? 'Add Credit' : 'Deduct Credit'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={statusModal.isOpen} onOpenChange={(open) => !open && setStatusModal({ isOpen: false, agent: null, newStatus: null })}>
        <DialogContent className="bg-[#0F172A] border-[#334155] text-[#F1F5F9] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#F5E1A4]">
              <AlertTriangle className="size-5 text-[#F59E0B]" />
              Confirm Status Change
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-[#94A3B8]">
              Are you sure you want to change <span className="text-[#F1F5F9] font-medium">{statusModal.agent?.name}</span>&apos;s status to{' '}
              <span className={cn(
                'font-medium',
                statusModal.newStatus === 'active' && 'text-[#22C55E]',
                statusModal.newStatus === 'inactive' && 'text-[#64748B]',
                statusModal.newStatus === 'suspended' && 'text-[#EF4444]'
              )}>
                {statusModal.newStatus}
              </span>?
            </p>

            {statusModal.newStatus === 'suspended' && (
              <div className="mt-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                <p className="text-sm text-[#EF4444]">
                  Suspending this agent will immediately stop all betting activities and prevent any transactions.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setStatusModal({ isOpen: false, agent: null, newStatus: null })}
              className="border-[#334155] text-[#94A3B8]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={isProcessing}
              className={cn(
                'min-w-[120px]',
                statusModal.newStatus === 'active' && 'bg-[#22C55E] hover:bg-[#16A34A]',
                statusModal.newStatus === 'inactive' && 'bg-[#64748B] hover:bg-[#475569]',
                statusModal.newStatus === 'suspended' && 'bg-[#EF4444] hover:bg-[#DC2626]'
              )}
            >
              {isProcessing ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
