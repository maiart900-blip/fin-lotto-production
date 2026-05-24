'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Ticket, Plus, Trash2, ShoppingCart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LotteryType {
  id: string;
  name: string;
  slug: string;
  close_time: string;
  status: string;
}

interface BetItem {
  id: string;
  number: string;
  betType: string;
  amount: number;
}

const BET_TYPES = [
  { id: '3top', label: '3 ตัวบน', digits: 3, payRate: 900 },
  { id: '3tod', label: '3 ตัวโต๊ด', digits: 3, payRate: 150 },
  { id: '2top', label: '2 ตัวบน', digits: 2, payRate: 90 },
  { id: '2bot', label: '2 ตัวล่าง', digits: 2, payRate: 90 },
  { id: 'run3top', label: 'วิ่งบน', digits: 1, payRate: 3 },
  { id: 'run3bot', label: 'วิ่งล่าง', digits: 1, payRate: 4 },
];

export default function TenantBetPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [lotteries, setLotteries] = useState<LotteryType[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<LotteryType | null>(null);
  const [selectedBetType, setSelectedBetType] = useState(BET_TYPES[0]);
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [cart, setCart] = useState<BetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      // Fetch available lotteries
      const lotteriesRes = await fetch(`/api/tenant/${slug}/customer/lotteries`);
      if (lotteriesRes.ok) {
        const data = await lotteriesRes.json();
        setLotteries(data.lotteries || []);
        if (data.lotteries?.length > 0) {
          setSelectedLottery(data.lotteries[0]);
        }
      }

      // Fetch customer balance
      const customerRes = await fetch(`/api/tenant/${slug}/customer/me`);
      if (customerRes.ok) {
        const data = await customerRes.json();
        setCreditBalance(data.credit_balance || 0);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!number) {
      toast.error('กรุณากรอกเลข');
      return;
    }

    if (number.length !== selectedBetType.digits) {
      toast.error(`กรุณากรอกเลข ${selectedBetType.digits} ตัว`);
      return;
    }

    const amountNum = parseFloat(amount) || 1;
    if (amountNum < 1) {
      toast.error('ยอดแทงขั้นต่ำ 1 บาท');
      return;
    }

    const newItem: BetItem = {
      id: `${Date.now()}-${Math.random()}`,
      number,
      betType: selectedBetType.id,
      amount: amountNum,
    };

    setCart([...cart, newItem]);
    setNumber('');
    toast.success('เพิ่มลงตะกร้าแล้ว');
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('กรุณาเพิ่มเลขในตะกร้าก่อน');
      return;
    }

    if (totalAmount > creditBalance) {
      toast.error('ยอดเครดิตไม่เพียงพอ');
      return;
    }

    if (!selectedLottery) {
      toast.error('กรุณาเลือกหวย');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/customer/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lottery_id: selectedLottery.id,
          bets: cart.map(item => ({
            number: item.number,
            bet_type: item.betType,
            amount: item.amount,
          })),
        }),
      });

      if (res.ok) {
        toast.success('แทงหวยสำเร็จ');
        setCart([]);
        fetchData(); // Refresh balance
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const quickNumbers = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
  const quickAmounts = [1, 5, 10, 20, 50, 100];

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Ticket className="h-5 w-5 text-amber-400" />
            แทงหวย
          </h1>
          <p className="text-gray-400 text-sm">เลือกประเภทและกรอกเลข</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">เครดิต</p>
          <p className="text-amber-400 font-bold">{creditBalance.toLocaleString()} บาท</p>
        </div>
      </div>

      {/* Lottery Selection */}
      {lotteries.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {lotteries.map((lottery) => (
            <button
              key={lottery.id}
              onClick={() => setSelectedLottery(lottery)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-all ${
                selectedLottery?.id === lottery.id
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-[#1a1a3a] border-white/10 text-gray-300 hover:border-white/30'
              }`}
            >
              <p className="font-medium text-sm">{lottery.name}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ปิด {lottery.close_time}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-[#1a1a3a] rounded-xl p-6 text-center">
          <p className="text-gray-400">ไม่มีหวยเปิดขายขณะนี้</p>
        </div>
      )}

      {/* Bet Type Selection */}
      <div className="grid grid-cols-3 gap-2">
        {BET_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setSelectedBetType(type)}
            className={`p-2 rounded-lg border text-center transition-all ${
              selectedBetType.id === type.id
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-[#1a1a3a] border-white/10 text-gray-300 hover:border-white/30'
            }`}
          >
            <p className="font-medium text-sm">{type.label}</p>
            <p className="text-xs text-gray-400">จ่าย {type.payRate}</p>
          </button>
        ))}
      </div>

      {/* Number Input */}
      <div className="bg-[#1a1a3a] rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            type="text"
            value={number}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              if (val.length <= selectedBetType.digits) {
                setNumber(val);
              }
            }}
            placeholder={`กรอกเลข ${selectedBetType.digits} ตัว`}
            className="bg-[#12122a] border-white/10 text-white text-center text-2xl font-mono tracking-widest"
            maxLength={selectedBetType.digits}
          />
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="บาท"
            className="bg-[#12122a] border-white/10 text-white w-24"
          />
          <Button
            onClick={handleAddToCart}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick Amounts */}
        <div className="flex gap-1 flex-wrap">
          {quickAmounts.map((amt) => (
            <Button
              key={amt}
              variant="outline"
              size="sm"
              onClick={() => setAmount(amt.toString())}
              className={`border-white/20 text-xs ${
                amount === amt.toString() ? 'bg-amber-500/20 border-amber-500' : ''
              }`}
            >
              {amt}
            </Button>
          ))}
        </div>

        {/* Quick Numbers for 2 digits */}
        {selectedBetType.digits === 2 && (
          <div className="flex gap-1 flex-wrap">
            {quickNumbers.map((num) => (
              <Button
                key={num}
                variant="outline"
                size="sm"
                onClick={() => setNumber(num)}
                className="border-white/20 text-xs font-mono"
              >
                {num}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="bg-[#1a1a3a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            ตะกร้า ({cart.length})
          </h3>
          <p className="text-amber-400 font-bold">{totalAmount.toLocaleString()} บาท</p>
        </div>

        {cart.length === 0 ? (
          <p className="text-gray-500 text-center py-4 text-sm">ยังไม่มีรายการ</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cart.map((item) => {
              const betType = BET_TYPES.find(t => t.id === item.betType);
              return (
                <div key={item.id} className="flex items-center justify-between bg-[#12122a] rounded-lg p-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold text-amber-400">{item.number}</span>
                    <span className="text-xs text-gray-400">{betType?.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.amount} บาท</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-400 hover:text-red-300"
                      onClick={() => handleRemoveFromCart(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={cart.length === 0 || submitting || totalAmount > creditBalance}
        className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
      >
        {submitting ? 'กำลังส่ง...' : `ยืนยันแทง ${totalAmount.toLocaleString()} บาท`}
      </Button>

      {totalAmount > creditBalance && (
        <p className="text-red-400 text-center text-sm">ยอดเครดิตไม่เพียงพอ</p>
      )}
    </div>
  );
}
