'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RouteGuard } from '@/components/security/route-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Terminal,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Gamepad2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TestResult {
  success: boolean;
  balance?: number;
  transaction_id?: string;
  error_code?: string;
  error_message?: string;
  timestamp: number;
  duration?: number;
}

interface TestLog {
  id: string;
  action: string;
  request: Record<string, unknown>;
  response: TestResult;
  timestamp: Date;
  duration: number;
}

export default function SeamlessTesterPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [betAmount, setBetAmount] = useState('100');
  const [winAmount, setWinAmount] = useState('200');
  const [gameProvider, setGameProvider] = useState('pgsoft');
  const [gameId, setGameId] = useState('game_001');
  const [loading, setLoading] = useState<string | null>(null);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  
  // Fetch customers for selection
  const { data: customers } = useSWR('/api/customers?limit=100', fetcher);
  
  // Filter customers
  const filteredCustomers = customers?.customers?.filter((c: { name: string; phone: string }) =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  ) || [];

  // Generate unique round ID
  const generateRoundId = () => `round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Execute seamless API call
  const executeCallback = async (action: string, extraData: Record<string, unknown> = {}) => {
    if (!selectedCustomer) {
      toast.error('กรุณาเลือกลูกค้าก่อน');
      return;
    }
    
    setLoading(action);
    const startTime = Date.now();
    const roundId = generateRoundId();
    
    const request = {
      action,
      player_id: selectedCustomer,
      game_provider: gameProvider,
      game_id: gameId,
      round_id: roundId,
      timestamp: Math.floor(Date.now() / 1000),
      ...extraData,
    };
    
    try {
      const res = await fetch('/api/games/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      
      const response: TestResult = await res.json();
      const duration = Date.now() - startTime;
      
      // Add to logs
      setTestLogs(prev => [{
        id: roundId,
        action,
        request,
        response: { ...response, duration },
        timestamp: new Date(),
        duration,
      }, ...prev.slice(0, 49)]); // Keep last 50 logs
      
      if (response.success) {
        toast.success(`${action.toUpperCase()} สำเร็จ - ยอดคงเหลือ: ${response.balance?.toLocaleString()} บาท`);
      } else {
        toast.error(`${action.toUpperCase()} ล้มเหลว: ${response.error_message}`);
      }
      
      return response;
    } catch (error) {
      console.error('Callback error:', error);
      toast.error('เกิดข้อผิดพลาดในการเรียก API');
    } finally {
      setLoading(null);
    }
  };
  
  // Test scenarios
  const runBalanceCheck = () => executeCallback('balance');
  
  const runBetTest = () => executeCallback('bet', { amount: Number(betAmount) });
  
  const runWinTest = () => executeCallback('win', { amount: Number(winAmount) });
  
  const runFullRound = async () => {
    setLoading('full_round');
    const roundId = generateRoundId();
    
    // 1. Check balance
    await executeCallback('balance');
    await new Promise(r => setTimeout(r, 500));
    
    // 2. Place bet
    const betResult = await executeCallback('bet', { amount: Number(betAmount) });
    if (!betResult?.success) {
      setLoading(null);
      return;
    }
    await new Promise(r => setTimeout(r, 500));
    
    // 3. Win (or lose if winAmount is 0)
    await executeCallback('win', { 
      amount: Number(winAmount),
      bet_id: betResult.transaction_id,
    });
    
    setLoading(null);
    toast.success('จำลองรอบเกมเสร็จสิ้น!');
  };
  
  const runRefundTest = () => {
    const lastBet = testLogs.find(l => l.action === 'bet' && l.response.success);
    if (!lastBet) {
      toast.error('ไม่พบรายการ Bet ที่จะคืนเงิน');
      return;
    }
    
    executeCallback('refund', {
      amount: lastBet.request.amount,
      bet_id: lastBet.response.transaction_id,
    });
  };

  return (
    <RouteGuard requireSuperAdmin>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-amber-500" />
            Seamless API Tester
          </h1>
          <p className="text-slate-500">ทดสอบระบบ Callback จำลองค่ายเกม</p>
        </div>
        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
          Development Mode
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Customer Selection */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                เลือกลูกค้าทดสอบ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="ค้นหาชื่อ/เบอร์โทร..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9 bg-slate-800/50 border-slate-600"
                />
              </div>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="bg-slate-800/50 border-slate-600">
                  <SelectValue placeholder="เลือกลูกค้า..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCustomers.slice(0, 20).map((c: { id: string; name: string; phone: string; credit_balance: number }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.phone}) - {Number(c.credit_balance).toLocaleString()} บาท
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Game Settings */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ตั้งค่าเกม</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Game Provider</Label>
                <Select value={gameProvider} onValueChange={setGameProvider}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pgsoft">PG Soft</SelectItem>
                    <SelectItem value="joker">Joker Gaming</SelectItem>
                    <SelectItem value="pragmatic">Pragmatic Play</SelectItem>
                    <SelectItem value="spadegaming">Spade Gaming</SelectItem>
                    <SelectItem value="habanero">Habanero</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Game ID</Label>
                <Input
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="bg-slate-800/50 border-slate-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">ยอดเดิมพัน</Label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">ยอดชนะ</Label>
                  <Input
                    type="number"
                    value={winAmount}
                    onChange={(e) => setWinAmount(e.target.value)}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                onClick={runBalanceCheck}
                disabled={!!loading}
              >
                <Wallet className="h-4 w-4 mr-2" />
                {loading === 'balance' ? 'กำลังเช็ค...' : 'Check Balance'}
              </Button>
              <Button
                className="w-full justify-start bg-red-600 hover:bg-red-700"
                onClick={runBetTest}
                disabled={!!loading}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                {loading === 'bet' ? 'กำลังเดิมพัน...' : `Bet ${Number(betAmount).toLocaleString()}`}
              </Button>
              <Button
                className="w-full justify-start bg-green-600 hover:bg-green-700"
                onClick={runWinTest}
                disabled={!!loading}
              >
                <ArrowDownLeft className="h-4 w-4 mr-2" />
                {loading === 'win' ? 'กำลังจ่าย...' : `Win ${Number(winAmount).toLocaleString()}`}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                onClick={runRefundTest}
                disabled={!!loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refund Last Bet
              </Button>
              <div className="pt-2 border-t border-slate-700">
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  onClick={runFullRound}
                  disabled={!!loading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {loading === 'full_round' ? 'กำลังจำลอง...' : 'Run Full Round (Balance → Bet → Win)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Panel */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-900/50 border-slate-700/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  API Response Logs
                </span>
                <Badge variant="secondary">{testLogs.length} entries</Badge>
              </CardTitle>
              <CardDescription>ประวัติการเรียก Seamless API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {testLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>ยังไม่มีการทดสอบ</p>
                    <p className="text-sm">เลือกลูกค้าและกดปุ่มทดสอบด้านซ้าย</p>
                  </div>
                ) : (
                  testLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${
                        log.response.success
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.response.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                          <Badge
                            className={
                              log.action === 'balance' ? 'bg-blue-500/20 text-blue-400' :
                              log.action === 'bet' ? 'bg-red-500/20 text-red-400' :
                              log.action === 'win' ? 'bg-green-500/20 text-green-400' :
                              'bg-amber-500/20 text-amber-400'
                            }
                          >
                            {log.action.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {log.timestamp.toLocaleTimeString('th-TH')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {log.duration}ms
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Request:</p>
                          <pre className="text-xs bg-slate-800/50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(
                              { 
                                action: log.request.action,
                                amount: log.request.amount,
                                round_id: String(log.request.round_id).slice(0, 20) + '...',
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Response:</p>
                          <pre className="text-xs bg-slate-800/50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(
                              {
                                success: log.response.success,
                                balance: log.response.balance?.toLocaleString(),
                                error: log.response.error_message,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* API Documentation */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">API Documentation</CardTitle>
          <CardDescription>Endpoint: POST /api/games/callback</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="balance">
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="balance">Balance</TabsTrigger>
              <TabsTrigger value="bet">Bet</TabsTrigger>
              <TabsTrigger value="win">Win</TabsTrigger>
              <TabsTrigger value="refund">Refund</TabsTrigger>
              <TabsTrigger value="rollback">Rollback</TabsTrigger>
            </TabsList>
            
            <TabsContent value="balance" className="mt-4">
              <pre className="bg-slate-800/50 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "action": "balance",
  "player_id": "customer_uuid",
  "game_provider": "pgsoft",
  "game_id": "game_001",
  "round_id": "unique_round_id",
  "timestamp": 1234567890
}`}
              </pre>
            </TabsContent>
            
            <TabsContent value="bet" className="mt-4">
              <pre className="bg-slate-800/50 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "action": "bet",
  "player_id": "customer_uuid",
  "amount": 100,
  "game_provider": "pgsoft",
  "game_id": "game_001",
  "round_id": "unique_round_id",
  "timestamp": 1234567890
}`}
              </pre>
            </TabsContent>
            
            <TabsContent value="win" className="mt-4">
              <pre className="bg-slate-800/50 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "action": "win",
  "player_id": "customer_uuid",
  "amount": 200,
  "game_provider": "pgsoft",
  "game_id": "game_001",
  "round_id": "unique_round_id",
  "bet_id": "original_bet_transaction_id",
  "timestamp": 1234567890
}`}
              </pre>
            </TabsContent>
            
            <TabsContent value="refund" className="mt-4">
              <pre className="bg-slate-800/50 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "action": "refund",
  "player_id": "customer_uuid",
  "amount": 100,
  "game_provider": "pgsoft",
  "game_id": "game_001",
  "round_id": "unique_round_id",
  "bet_id": "original_bet_transaction_id",
  "timestamp": 1234567890
}`}
              </pre>
            </TabsContent>
            
            <TabsContent value="rollback" className="mt-4">
              <pre className="bg-slate-800/50 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "action": "rollback",
  "player_id": "customer_uuid",
  "amount": 100,
  "game_provider": "pgsoft",
  "game_id": "game_001",
  "round_id": "unique_round_id",
  "bet_id": "original_bet_transaction_id",
  "timestamp": 1234567890
}`}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
    </RouteGuard>
  );
}
