'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  FileBarChart, 
  Download, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Keyboard,
  Zap,
  BarChart3,
  Receipt,
  Calculator,
  Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(amount);
};

const datePresets = [
  { label: 'วันนี้', value: 'today' },
  { label: 'เมื่อวาน', value: 'yesterday' },
  { label: '7 วันล่าสุด', value: '7days' },
  { label: 'เดือนนี้', value: 'thisMonth' },
  { label: 'เดือนที่แล้ว', value: 'lastMonth' },
  { label: '3 เดือน', value: '3months' },
  { label: '6 เดือน', value: '6months' },
  { label: '1 ปี', value: '1year' },
];

function getDateRange(preset: string) {
  const today = new Date();
  let dateFrom = new Date();
  const dateTo = new Date();

  switch (preset) {
    case 'today':
      break;
    case 'yesterday':
      dateFrom.setDate(today.getDate() - 1);
      dateTo.setDate(today.getDate() - 1);
      break;
    case '7days':
      dateFrom.setDate(today.getDate() - 7);
      break;
    case 'thisMonth':
      dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'lastMonth':
      dateFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      dateTo.setDate(0); // Last day of previous month
      break;
    case '3months':
      dateFrom.setMonth(today.getMonth() - 3);
      break;
    case '6months':
      dateFrom.setMonth(today.getMonth() - 6);
      break;
    case '1year':
      dateFrom.setFullYear(today.getFullYear() - 1);
      break;
    default:
      dateFrom.setDate(today.getDate() - 30);
  }

  return {
    dateFrom: dateFrom.toISOString().split('T')[0],
    dateTo: dateTo.toISOString().split('T')[0],
  };
}

export default function ComparisonReportPage() {
  const [datePreset, setDatePreset] = useState('thisMonth');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [sourceType, setSourceType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { dateFrom, dateTo } = customDateFrom && customDateTo 
    ? { dateFrom: customDateFrom, dateTo: customDateTo }
    : getDateRange(datePreset);

  const { data, error, isLoading } = useSWR(
    `/api/admin/reports/source-comparison?dateFrom=${dateFrom}&dateTo=${dateTo}&sourceType=${sourceType}`,
    fetcher
  );

  const handleExportCSV = () => {
    if (!data?.tableData) return;
    
    const headers = ['วันที่', 'ประเภท', 'หวย', 'ยอดแทง', 'ยอดถูก', 'กำไร/ขาดทุน', 'สถานะ'];
    const rows = data.tableData.map((row: { date: string; sourceType: string; lottery: string; amount: number; payout: number; profit: number; status: string }) => [
      row.date,
      row.sourceType === 'manual_key' ? 'คีย์หวย' : 'ออโต้',
      row.lottery,
      row.amount,
      row.payout,
      row.profit,
      row.status,
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comparison-report-${dateFrom}-${dateTo}.csv`;
    link.click();
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center text-red-400">
            เกิดข้อผิดพลาดในการโหลดรายงาน
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileBarChart className="size-6 text-amber-400" />
            รายงานเปรียบเทียบ คีย์หวย vs ออโต้
          </h1>
          <p className="text-white/60 mt-1">เปรียบเทียบยอดและสถิติระหว่างระบบคีย์หวยและออโต้</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <Filter className="size-4 mr-2" />
            ตัวกรอง
          </Button>
          <Button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700">
            <Download className="size-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="bg-[#0D1321] border-white/10">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-white/60 text-sm mb-1 block">ช่วงเวลา</label>
                <Select value={datePreset} onValueChange={(v) => { setDatePreset(v); setCustomDateFrom(''); setCustomDateTo(''); }}>
                  <SelectTrigger className="bg-[#1a1f35] border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {datePresets.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white/60 text-sm mb-1 block">วันที่เริ่ม (custom)</label>
                <Input 
                  type="date" 
                  value={customDateFrom} 
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="bg-[#1a1f35] border-white/20 text-white"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm mb-1 block">วันที่สิ้นสุด (custom)</label>
                <Input 
                  type="date" 
                  value={customDateTo} 
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="bg-[#1a1f35] border-white/20 text-white"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm mb-1 block">ประเภทระบบ</label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger className="bg-[#1a1f35] border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="manual_key">คีย์หวย</SelectItem>
                    <SelectItem value="auto">ออโต้</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-amber-400" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total */}
            <Card className="bg-gradient-to-br from-[#1a1f35] to-[#0D1321] border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-400 flex items-center gap-2 text-lg">
                  <BarChart3 className="size-5" />
                  รวมทั้งหมด
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">ยอดแทง</span>
                  <span className="text-white font-bold">{formatCurrency(data?.summary?.total?.totalBet || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">ยอดถูก</span>
                  <span className="text-red-400">{formatCurrency(data?.summary?.total?.totalWin || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-white/60">กำไร/ขาดทุน</span>
                  <span className={`font-bold ${(data?.summary?.total?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(data?.summary?.total?.profit || 0) >= 0 ? '+' : ''}{formatCurrency(data?.summary?.total?.profit || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">จำนวนโพย</span>
                  <span className="text-white">{data?.summary?.total?.entryCount || 0} รายการ</span>
                </div>
              </CardContent>
            </Card>

            {/* Manual Key */}
            <Card className="bg-gradient-to-br from-blue-900/30 to-[#0D1321] border-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-400 flex items-center gap-2 text-lg">
                  <Keyboard className="size-5" />
                  คีย์หวย (Manual Key)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">ยอดแทง</span>
                  <span className="text-white font-bold">{formatCurrency(data?.summary?.manual_key?.totalBet || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">ยอดถูก</span>
                  <span className="text-red-400">{formatCurrency(data?.summary?.manual_key?.totalWin || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-white/60">กำไร/ขาดทุน</span>
                  <span className={`font-bold ${(data?.summary?.manual_key?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(data?.summary?.manual_key?.profit || 0) >= 0 ? '+' : ''}{formatCurrency(data?.summary?.manual_key?.profit || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">จำนวนโพย</span>
                  <span className="text-white">{data?.summary?.manual_key?.entryCount || 0} รายการ</span>
                </div>
              </CardContent>
            </Card>

            {/* Auto */}
            <Card className="bg-gradient-to-br from-green-900/30 to-[#0D1321] border-green-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-green-400 flex items-center gap-2 text-lg">
                  <Zap className="size-5" />
                  ออโต้ (Auto)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">ยอดแทง</span>
                  <span className="text-white font-bold">{formatCurrency(data?.summary?.auto?.totalBet || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">ยอดถูก</span>
                  <span className="text-red-400">{formatCurrency(data?.summary?.auto?.totalWin || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-white/60">กำไร/ขาดทุน</span>
                  <span className={`font-bold ${(data?.summary?.auto?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(data?.summary?.auto?.profit || 0) >= 0 ? '+' : ''}{formatCurrency(data?.summary?.auto?.profit || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">จำนวนโพย</span>
                  <span className="text-white">{data?.summary?.auto?.entryCount || 0} รายการ</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Comparison */}
            <Card className="bg-[#0D1321] border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="size-5 text-amber-400" />
                  เปรียบเทียบยอดแทงรายวัน
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.chartData && data.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#999" tick={{ fill: '#999', fontSize: 12 }} />
                      <YAxis stroke="#999" tick={{ fill: '#999', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1f35', border: '1px solid #333' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      <Bar dataKey="manual_key" name="คีย์หวย" fill="#3b82f6" />
                      <Bar dataKey="auto" name="ออโต้" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-white/40">
                    ไม่มีข้อมูล
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Chart - Profit */}
            <Card className="bg-[#0D1321] border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="size-5 text-green-400" />
                  กำไร/ขาดทุนรายวัน
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.chartData && data.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#999" tick={{ fill: '#999', fontSize: 12 }} />
                      <YAxis stroke="#999" tick={{ fill: '#999', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1f35', border: '1px solid #333' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="profit_manual" name="กำไรคีย์หวย" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="profit_auto" name="กำไรออโต้" stroke="#22c55e" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-white/40">
                    ไม่มีข้อมูล
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lottery Breakdown */}
          <Card className="bg-[#0D1321] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Receipt className="size-5 text-amber-400" />
                ยอดแทงแยกตามประเภทหวย
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.lotteryBreakdown && data.lotteryBreakdown.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.lotteryBreakdown.slice(0, 9).map((lottery: { name: string; manual_key: number; auto: number; total: number }, idx: number) => (
                    <div key={idx} className="bg-[#1a1f35] rounded-lg p-4">
                      <div className="text-white font-medium mb-2">{lottery.name}</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-400">คีย์หวย</span>
                          <span className="text-white">{formatCurrency(lottery.manual_key)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-400">ออโต้</span>
                          <span className="text-white">{formatCurrency(lottery.auto)}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-1">
                          <span className="text-amber-400">รวม</span>
                          <span className="text-white font-bold">{formatCurrency(lottery.total)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-white/40 py-8">ไม่มีข้อมูล</div>
              )}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-[#0D1321] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calculator className="size-5 text-amber-400" />
                รายการโพยล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.tableData && data.tableData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/60">วันที่</TableHead>
                        <TableHead className="text-white/60">ประเภท</TableHead>
                        <TableHead className="text-white/60">หวย</TableHead>
                        <TableHead className="text-white/60 text-right">ยอดแทง</TableHead>
                        <TableHead className="text-white/60 text-right">ยอดถูก</TableHead>
                        <TableHead className="text-white/60 text-right">กำไร/ขาดทุน</TableHead>
                        <TableHead className="text-white/60">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.tableData.map((row: { id: string; date: string; sourceType: string; lottery: string; amount: number; payout: number; profit: number; status: string }) => (
                        <TableRow key={row.id} className="border-white/10">
                          <TableCell className="text-white">{row.date}</TableCell>
                          <TableCell>
                            <Badge className={row.sourceType === 'manual_key' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}>
                              {row.sourceType === 'manual_key' ? 'คีย์หวย' : 'ออโต้'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white">{row.lottery}</TableCell>
                          <TableCell className="text-white text-right">{formatCurrency(row.amount)}</TableCell>
                          <TableCell className="text-red-400 text-right">{formatCurrency(row.payout)}</TableCell>
                          <TableCell className={`text-right font-medium ${row.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {row.profit >= 0 ? '+' : ''}{formatCurrency(row.profit)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-white/20 text-white/60">
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-white/40 py-8">ไม่มีข้อมูล</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
