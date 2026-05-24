import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { getDailyClosings, getMonthlySummaries, getYearlySummaries } from '@/lib/daily-closing';

// GET - Export data as Excel or PDF
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบ authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'daily';
    const format = searchParams.get('format') || 'excel';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');

    // Fetch data based on type
    let data: unknown[] = [];
    let sheetName = 'Daily Closing';

    switch (type) {
      case 'daily':
        if (startDate && endDate) {
          data = await getDailyClosings(startDate, endDate);
        } else {
          // Default to last 30 days
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 30);
          data = await getDailyClosings(
            start.toISOString().split('T')[0],
            end.toISOString().split('T')[0]
          );
        }
        sheetName = 'รายงานรายวัน';
        break;

      case 'monthly':
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        data = await getMonthlySummaries(targetYear);
        sheetName = `รายงานรายเดือน ${targetYear}`;
        break;

      case 'yearly':
        data = await getYearlySummaries();
        sheetName = 'รายงานรายปี';
        break;
    }

    if (format === 'excel') {
      return generateExcel(data, type, sheetName);
    } else if (format === 'pdf') {
      // For PDF, return JSON that client can use to generate PDF
      return generatePDFData(data, type, sheetName);
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateExcel(data: unknown[], type: string, sheetName: string): NextResponse {
  // Transform data for Excel
  const excelData = transformDataForExcel(data, type);

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create main sheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const columnWidths = getColumnWidths(type);
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Create summary sheet
  const summaryData = createSummaryData(data, type);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'สรุป');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Return as downloadable file
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="daily-closing-${type}-${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  });
}

function generatePDFData(data: unknown[], type: string, title: string): NextResponse {
  // Return structured data for client-side PDF generation
  const pdfData = {
    title,
    generatedAt: new Date().toISOString(),
    type,
    data: transformDataForExcel(data, type),
    summary: createSummaryData(data, type),
  };

  // For now, return JSON - client can use libraries like jsPDF or react-pdf
  // In production, you might want to use a server-side PDF library
  return NextResponse.json(pdfData, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

interface DailyRecord {
  closing_date?: string;
  total_deposits?: number;
  deposit_count?: number;
  total_withdrawals?: number;
  withdrawal_count?: number;
  total_bets?: number;
  bet_count?: number;
  total_payouts?: number;
  payout_count?: number;
  agent_commission?: number;
  gross_profit?: number;
  net_profit?: number;
  new_customers?: number;
  active_customers?: number;
  status?: string;
}

interface MonthlyRecord {
  year?: number;
  month?: number;
  total_deposits?: number;
  total_withdrawals?: number;
  total_bets?: number;
  total_payouts?: number;
  agent_commission?: number;
  gross_profit?: number;
  net_profit?: number;
  new_customers?: number;
  days_count?: number;
}

interface YearlyRecord {
  year?: number;
  total_deposits?: number;
  total_withdrawals?: number;
  total_bets?: number;
  total_payouts?: number;
  agent_commission?: number;
  gross_profit?: number;
  net_profit?: number;
  new_customers?: number;
}

function transformDataForExcel(data: unknown[], type: string): Record<string, unknown>[] {
  const monthNames = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  switch (type) {
    case 'daily':
      return (data as DailyRecord[]).map(row => ({
        'วันที่': row.closing_date || '',
        'ยอดฝาก': formatNumber(row.total_deposits),
        'จำนวนฝาก': row.deposit_count || 0,
        'ยอดถอน': formatNumber(row.total_withdrawals),
        'จำนวนถอน': row.withdrawal_count || 0,
        'ยอดแทง': formatNumber(row.total_bets),
        'จำนวนแทง': row.bet_count || 0,
        'ยอดจ่าย': formatNumber(row.total_payouts),
        'จำนวนจ่าย': row.payout_count || 0,
        'ค่าคอมเอเย่นต์': formatNumber(row.agent_commission),
        'กำไรขั้นต้น': formatNumber(row.gross_profit),
        'กำไรสุทธิ': formatNumber(row.net_profit),
        'สมาชิกใหม่': row.new_customers || 0,
        'สมาชิก Active': row.active_customers || 0,
        'สถานะ': getStatusText(row.status),
      }));

    case 'monthly':
      return (data as MonthlyRecord[]).map(row => ({
        'ปี': row.year || '',
        'เดือน': monthNames[row.month || 0] || '',
        'ยอดฝาก': formatNumber(row.total_deposits),
        'ยอดถอน': formatNumber(row.total_withdrawals),
        'ยอดแทง': formatNumber(row.total_bets),
        'ยอดจ่าย': formatNumber(row.total_payouts),
        'ค่าคอมเอเย่นต์': formatNumber(row.agent_commission),
        'กำไรขั้นต้น': formatNumber(row.gross_profit),
        'กำไรสุทธิ': formatNumber(row.net_profit),
        'สมาชิกใหม่': row.new_customers || 0,
        'จำนวนวัน': row.days_count || 0,
      }));

    case 'yearly':
      return (data as YearlyRecord[]).map(row => ({
        'ปี': row.year || '',
        'ยอดฝาก': formatNumber(row.total_deposits),
        'ยอดถอน': formatNumber(row.total_withdrawals),
        'ยอดแทง': formatNumber(row.total_bets),
        'ยอดจ่าย': formatNumber(row.total_payouts),
        'ค่าคอมเอเย่นต์': formatNumber(row.agent_commission),
        'กำไรขั้นต้น': formatNumber(row.gross_profit),
        'กำไรสุทธิ': formatNumber(row.net_profit),
        'สมาชิกใหม่': row.new_customers || 0,
      }));

    default:
      return data as Record<string, unknown>[];
  }
}

function createSummaryData(data: unknown[], type: string): Record<string, unknown>[] {
  if (data.length === 0) return [{ 'สรุป': 'ไม่มีข้อมูล' }];

  const totals = (data as DailyRecord[]).reduce((acc, row) => ({
    deposits: acc.deposits + Number(row.total_deposits || 0),
    withdrawals: acc.withdrawals + Number(row.total_withdrawals || 0),
    bets: acc.bets + Number(row.total_bets || 0),
    payouts: acc.payouts + Number(row.total_payouts || 0),
    commission: acc.commission + Number(row.agent_commission || 0),
    grossProfit: acc.grossProfit + Number(row.gross_profit || 0),
    netProfit: acc.netProfit + Number(row.net_profit || 0),
    newCustomers: acc.newCustomers + Number(row.new_customers || 0),
  }), {
    deposits: 0,
    withdrawals: 0,
    bets: 0,
    payouts: 0,
    commission: 0,
    grossProfit: 0,
    netProfit: 0,
    newCustomers: 0,
  });

  return [
    { 'รายการ': 'ยอดฝากรวม', 'จำนวน': formatNumber(totals.deposits) },
    { 'รายการ': 'ยอดถอนรวม', 'จำนวน': formatNumber(totals.withdrawals) },
    { 'รายการ': 'ยอดแทงรวม', 'จำนวน': formatNumber(totals.bets) },
    { 'รายการ': 'ยอดจ่ายรวม', 'จำนวน': formatNumber(totals.payouts) },
    { 'รายการ': 'ค่าคอมรวม', 'จำนวน': formatNumber(totals.commission) },
    { 'รายการ': 'กำไรขั้นต้นรวม', 'จำนวน': formatNumber(totals.grossProfit) },
    { 'รายการ': 'กำไรสุทธิรวม', 'จำนวน': formatNumber(totals.netProfit) },
    { 'รายการ': 'สมาชิกใหม่รวม', 'จำนวน': totals.newCustomers.toString() },
    { 'รายการ': '', 'จำนวน': '' },
    { 'รายการ': 'จำนวนรายการ', 'จำนวน': data.length.toString() },
    { 'รายการ': 'สร้างเมื่อ', 'จำนวน': new Date().toLocaleString('th-TH') },
  ];
}

function formatNumber(value?: number): string {
  if (value === undefined || value === null) return '0.00';
  return Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getStatusText(status?: string): string {
  switch (status) {
    case 'finalized': return 'ปิดยอดแล้ว (Auto)';
    case 'closed': return 'ปิดยอดแล้ว';
    case 'open': return 'ยังไม่ปิด';
    default: return status || '';
  }
}

function getColumnWidths(type: string): { wch: number }[] {
  switch (type) {
    case 'daily':
      return [
        { wch: 12 }, // วันที่
        { wch: 15 }, // ยอดฝาก
        { wch: 10 }, // จำนวนฝาก
        { wch: 15 }, // ยอดถอน
        { wch: 10 }, // จำนวนถอน
        { wch: 15 }, // ยอดแทง
        { wch: 10 }, // จำนวนแทง
        { wch: 15 }, // ยอดจ่าย
        { wch: 10 }, // จำนวนจ่าย
        { wch: 15 }, // ค่าคอม
        { wch: 15 }, // กำไรขั้นต้น
        { wch: 15 }, // กำไรสุทธิ
        { wch: 12 }, // สมาชิกใหม่
        { wch: 12 }, // Active
        { wch: 18 }, // สถานะ
      ];
    case 'monthly':
      return [
        { wch: 8 },  // ปี
        { wch: 15 }, // เดือน
        { wch: 15 }, // ยอดฝาก
        { wch: 15 }, // ยอดถอน
        { wch: 15 }, // ยอดแทง
        { wch: 15 }, // ยอดจ่าย
        { wch: 15 }, // ค่าคอม
        { wch: 15 }, // กำไรขั้นต้น
        { wch: 15 }, // กำไรสุทธิ
        { wch: 12 }, // สมาชิกใหม่
        { wch: 10 }, // จำนวนวัน
      ];
    case 'yearly':
      return [
        { wch: 8 },  // ปี
        { wch: 18 }, // ยอดฝาก
        { wch: 18 }, // ยอดถอน
        { wch: 18 }, // ยอดแทง
        { wch: 18 }, // ยอดจ่าย
        { wch: 18 }, // ค่าคอม
        { wch: 18 }, // กำไรขั้นต้น
        { wch: 18 }, // กำไรสุทธิ
        { wch: 12 }, // สมาชิกใหม่
      ];
    default:
      return [];
  }
}
