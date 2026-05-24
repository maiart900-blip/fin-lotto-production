'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useSWR from 'swr';
import { 
  Crown, Radio, Send, Shield, AlertTriangle, Activity,
  Wifi, WifiOff, Users, ArrowUpRight, Ban, Settings,
  Zap, Globe, Terminal, Clock, CheckCircle, XCircle,
  Megaphone, Lock, Unlock, TrendingUp, Server
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Command types with labels
const COMMAND_TYPES = {
  update_rates: { label: 'ปรับเรทจ่าย', icon: TrendingUp, color: 'bg-blue-500' },
  close_market: { label: 'ปิดรับ', icon: Lock, color: 'bg-red-500' },
  open_market: { label: 'เปิดรับ', icon: Unlock, color: 'bg-green-500' },
  block_number: { label: 'อั้นเลข', icon: Ban, color: 'bg-orange-500' },
  unblock_number: { label: 'ปลดอั้น', icon: CheckCircle, color: 'bg-teal-500' },
  update_limit: { label: 'ปรับวงเงิน', icon: Settings, color: 'bg-purple-500' },
  broadcast_message: { label: 'ประกาศ', icon: Megaphone, color: 'bg-yellow-500' },
  emergency_stop: { label: 'หยุดฉุกเฉิน', icon: AlertTriangle, color: 'bg-red-600' },
};

export default function CommandCenterPage() {
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const [commandPayload, setCommandPayload] = useState<Record<string, any>>({});
  const [targetAgents, setTargetAgents] = useState<'all' | string[]>('all');
  const [isSending, setIsSending] = useState(false);
  const [commandLog, setCommandLog] = useState<any[]>([]);

  // Fetch network summary
  const { data: networkSummary, mutate: refreshNetwork } = useSWR('/api/network/summary', fetcher, { refreshInterval: 5000 });
  
  // Fetch agents
  const { data: agents } = useSWR('/api/agents?status=active', fetcher);

  // Fetch lotteries
  const { data: lotteries } = useSWR('/api/lotteries?status=active', fetcher);

  // Send command
  const sendCommand = async () => {
    if (!selectedCommand) return;
    
    setIsSending(true);
    try {
      const response = await fetch('/api/command-center/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedCommand,
          payload: commandPayload,
          targetAgents,
          priority: selectedCommand === 'emergency_stop' ? 'critical' : 'high',
        }),
      });

      const result = await response.json();
      
      setCommandLog(prev => [{
        id: result.commandId,
        type: selectedCommand,
        payload: commandPayload,
        deliveredTo: result.deliveredTo,
        timestamp: new Date().toISOString(),
        success: result.success,
      }, ...prev].slice(0, 20));

      if (result.success) {
        setSelectedCommand('');
        setCommandPayload({});
        refreshNetwork();
      }
    } catch (error) {
      console.error('Send command error:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="live-midnight-canvas min-h-screen p-6 -m-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[#EAB308]/30">
            <Terminal className="size-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              Command Center
              <Badge className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A]">
                <Crown className="size-3 mr-1" />
                MASTER
              </Badge>
            </h1>
            <p className="text-[#64748B] mt-1">ศูนย์บัญชาการเครือข่าย FIN LOTTO R+</p>
          </div>
        </div>

        {/* Network Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E293B] border border-[#334155]">
            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[#94A3B8] text-sm">Network Active</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#EAB308]">
              {networkSummary?.onlineAgents || 0}/{networkSummary?.totalAgents || 0}
            </p>
            <p className="text-xs text-[#64748B]">Agents Online</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">Agents Online</p>
                <p className="text-3xl font-bold text-[#22C55E]">{networkSummary?.onlineAgents || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#22C55E]/20">
                <Wifi className="size-6 text-[#22C55E]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">Agents Offline</p>
                <p className="text-3xl font-bold text-[#EF4444]">{networkSummary?.offlineAgents || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#EF4444]/20">
                <WifiOff className="size-6 text-[#EF4444]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">Total Bets Today</p>
                <p className="text-3xl font-bold text-[#EAB308]">{(networkSummary?.todayTotalBets || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#EAB308]/20">
                <Activity className="size-6 text-[#EAB308]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">Volume Today</p>
                <p className="text-3xl font-bold text-[#F5E1A4]">{(networkSummary?.todayTotalVolume || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5E1A4]/20">
                <TrendingUp className="size-6 text-[#F5E1A4]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Command Panel - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="ultra-glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="size-5 text-[#EAB308]" />
                Command Pipe
                <Badge variant="outline" className="border-[#EAB308] text-[#EAB308]">
                  Master to Agents
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Command Type Selection */}
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(COMMAND_TYPES).map(([key, { label, icon: Icon, color }]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCommand(key)}
                    className={`p-3 rounded-xl border transition-all ${
                      selectedCommand === key
                        ? 'border-[#EAB308] bg-[#EAB308]/20'
                        : 'border-[#334155] bg-[#1E293B] hover:border-[#475569]'
                    }`}
                  >
                    <div className={`size-8 rounded-lg ${color} flex items-center justify-center mb-2 mx-auto`}>
                      <Icon className="size-4 text-white" />
                    </div>
                    <p className={`text-xs text-center ${selectedCommand === key ? 'text-[#EAB308]' : 'text-[#94A3B8]'}`}>
                      {label}
                    </p>
                  </button>
                ))}
              </div>

              {/* Command Configuration */}
              {selectedCommand && (
                <div className="space-y-4 p-4 rounded-xl bg-[#0F172A] border border-[#334155]">
                  <h4 className="text-[#F5E1A4] font-semibold">
                    Configure: {COMMAND_TYPES[selectedCommand as keyof typeof COMMAND_TYPES]?.label}
                  </h4>

                  {/* Target Selection */}
                  <div>
                    <label className="text-sm text-[#94A3B8] block mb-2">Target Agents</label>
                    <Select 
                      value={targetAgents === 'all' ? 'all' : 'selected'}
                      onValueChange={(v) => setTargetAgents(v === 'all' ? 'all' : [])}
                    >
                      <SelectTrigger className="bg-[#1E293B] border-[#334155] text-white">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents (Broadcast)</SelectItem>
                        <SelectItem value="selected">Selected Agents</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Lottery Selection (for market commands) */}
                  {['update_rates', 'close_market', 'open_market', 'block_number', 'update_limit'].includes(selectedCommand) && (
                    <div>
                      <label className="text-sm text-[#94A3B8] block mb-2">Lottery</label>
                      <Select
                        value={commandPayload.lotteryId || ''}
                        onValueChange={(v) => setCommandPayload(prev => ({ ...prev, lotteryId: v }))}
                      >
                        <SelectTrigger className="bg-[#1E293B] border-[#334155] text-white">
                          <SelectValue placeholder="Select lottery" />
                        </SelectTrigger>
                        <SelectContent>
                          {lotteries?.map((lottery: any) => (
                            <SelectItem key={lottery.id} value={lottery.id}>
                              {lottery.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Number input (for block/limit) */}
                  {['block_number', 'unblock_number', 'update_limit'].includes(selectedCommand) && (
                    <div>
                      <label className="text-sm text-[#94A3B8] block mb-2">Number</label>
                      <Input
                        placeholder="Enter number (e.g., 123)"
                        value={commandPayload.number || ''}
                        onChange={(e) => setCommandPayload(prev => ({ ...prev, number: e.target.value }))}
                        className="bg-[#1E293B] border-[#334155] text-white"
                      />
                    </div>
                  )}

                  {/* Limit input */}
                  {selectedCommand === 'update_limit' && (
                    <div>
                      <label className="text-sm text-[#94A3B8] block mb-2">New Limit</label>
                      <Input
                        type="number"
                        placeholder="Enter new limit"
                        value={commandPayload.newLimit || ''}
                        onChange={(e) => setCommandPayload(prev => ({ ...prev, newLimit: parseInt(e.target.value) }))}
                        className="bg-[#1E293B] border-[#334155] text-white"
                      />
                    </div>
                  )}

                  {/* Reason input */}
                  {['close_market', 'block_number', 'emergency_stop'].includes(selectedCommand) && (
                    <div>
                      <label className="text-sm text-[#94A3B8] block mb-2">Reason</label>
                      <Input
                        placeholder="Enter reason"
                        value={commandPayload.reason || ''}
                        onChange={(e) => setCommandPayload(prev => ({ ...prev, reason: e.target.value }))}
                        className="bg-[#1E293B] border-[#334155] text-white"
                      />
                    </div>
                  )}

                  {/* Message input */}
                  {selectedCommand === 'broadcast_message' && (
                    <div>
                      <label className="text-sm text-[#94A3B8] block mb-2">Message</label>
                      <Input
                        placeholder="Enter broadcast message"
                        value={commandPayload.message || ''}
                        onChange={(e) => setCommandPayload(prev => ({ ...prev, message: e.target.value }))}
                        className="bg-[#1E293B] border-[#334155] text-white"
                      />
                    </div>
                  )}

                  {/* Send Button */}
                  <Button
                    onClick={sendCommand}
                    disabled={isSending}
                    className={`w-full ${
                      selectedCommand === 'emergency_stop'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'btn-reflective-gold'
                    }`}
                  >
                    {isSending ? (
                      <>
                        <Radio className="size-4 mr-2 animate-pulse" />
                        Broadcasting...
                      </>
                    ) : (
                      <>
                        <Send className="size-4 mr-2" />
                        Send Command to {targetAgents === 'all' ? 'All Agents' : `${(targetAgents as string[]).length} Agents`}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Command Log */}
          <Card className="midnight-section">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="size-5 text-[#EAB308]" />
                Command Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {commandLog.length === 0 ? (
                  <p className="text-[#64748B] text-center py-8">No commands sent yet</p>
                ) : (
                  commandLog.map((log) => {
                    const cmdInfo = COMMAND_TYPES[log.type as keyof typeof COMMAND_TYPES];
                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#0F172A] border border-[#1E293B]"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-lg ${cmdInfo?.color} flex items-center justify-center`}>
                            {cmdInfo?.icon && <cmdInfo.icon className="size-4 text-white" />}
                          </div>
                          <div>
                            <p className="text-white font-medium">{cmdInfo?.label}</p>
                            <p className="text-xs text-[#64748B]">
                              {new Date(log.timestamp).toLocaleTimeString('th-TH')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-[#334155] text-[#94A3B8]">
                            {log.deliveredTo} agents
                          </Badge>
                          {log.success ? (
                            <CheckCircle className="size-5 text-green-500" />
                          ) : (
                            <XCircle className="size-5 text-red-500" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Status Panel */}
        <div className="space-y-6">
          <Card className="ultra-glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Server className="size-5 text-[#EAB308]" />
                Agent Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {agents?.map((agent: any) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#0F172A] border border-[#1E293B]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-3 rounded-full ${agent.sync_status === 'synced' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                      <div>
                        <p className="text-white font-medium">{agent.code}</p>
                        <p className="text-xs text-[#64748B]">{agent.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant="outline" 
                        className={agent.status === 'active' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}
                      >
                        {agent.status === 'active' ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {!agents?.length && (
                  <p className="text-[#64748B] text-center py-8">No agents connected</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="midnight-section">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="size-5 text-[#EAB308]" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start border-[#334155] text-[#94A3B8] hover:border-[#EAB308] hover:text-[#EAB308]"
                onClick={() => {
                  setSelectedCommand('force_sync');
                  setTargetAgents('all');
                }}
              >
                <Globe className="size-4 mr-2" />
                Force Sync All Agents
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start border-[#334155] text-[#94A3B8] hover:border-green-500 hover:text-green-500"
                onClick={() => {
                  setSelectedCommand('open_market');
                  setTargetAgents('all');
                }}
              >
                <Unlock className="size-4 mr-2" />
                Open All Markets
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start border-[#334155] text-[#94A3B8] hover:border-red-500 hover:text-red-500"
                onClick={() => {
                  setSelectedCommand('close_market');
                  setTargetAgents('all');
                }}
              >
                <Lock className="size-4 mr-2" />
                Close All Markets
              </Button>
              <Button 
                variant="destructive" 
                className="w-full justify-start bg-red-600/20 border border-red-500 text-red-500 hover:bg-red-600 hover:text-white"
                onClick={() => {
                  setSelectedCommand('emergency_stop');
                  setTargetAgents('all');
                }}
              >
                <AlertTriangle className="size-4 mr-2" />
                EMERGENCY STOP
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
