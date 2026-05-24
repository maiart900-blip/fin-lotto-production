'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Zap,
  Trash2,
  Send,
  Keyboard,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { parseBetInput, formatBetType, type ParsedBet, type ParseResult } from '@/lib/bet-parser';
import { cn, formatCurrency } from '@/lib/utils';

interface SmartBetInputProps {
  lotteryId: string;
  lotteryName: string;
  onAddBets: (bets: ParsedBet[]) => void;
  disabled?: boolean;
}

export function SmartBetInput({ lotteryId, lotteryName, onAddBets, disabled }: SmartBetInputProps) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-parse on input change
  useEffect(() => {
    if (input.trim()) {
      const result = parseBetInput(input);
      setPreview(result);
    } else {
      setPreview(null);
    }
  }, [input]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    // Enter = confirm and add
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      if (preview?.success && preview.bets.length > 0) {
        // Check if all bets have amount
        const hasAllAmounts = preview.bets.every(b => b.amount > 0);
        if (hasAllAmounts) {
          setShowConfirm(true);
        } else {
          toast.error('กรุณาระบุจำนวนเงิน');
        }
      }
    }
    
    // Ctrl+Enter = force add without confirm
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (preview?.success && preview.bets.length > 0) {
        const hasAllAmounts = preview.bets.every(b => b.amount > 0);
        if (hasAllAmounts) {
          confirmAdd();
        } else {
          toast.error('กรุณาระบุจำนวนเงิน');
        }
      }
    }
    
    // Escape = clear input
    if (e.key === 'Escape') {
      e.preventDefault();
      setInput('');
      setPreview(null);
      setHistoryIndex(-1);
    }
    
    // Arrow Up = previous history
    if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInput(history[history.length - 1 - newIndex] || '');
    }
    
    // Arrow Down = next history
    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = historyIndex > 0 ? historyIndex - 1 : -1;
      setHistoryIndex(newIndex);
      setInput(newIndex >= 0 ? history[history.length - 1 - newIndex] : '');
    }
    
    // F1 = show help
    if (e.key === 'F1') {
      e.preventDefault();
      setShowHelp(true);
    }
  }, [preview, history, historyIndex]);

  // Confirm and add bets
  const confirmAdd = useCallback(() => {
    if (!preview?.success || preview.bets.length === 0) return;
    
    onAddBets(preview.bets);
    
    // Add to history
    setHistory(prev => [...prev.slice(-19), input]);
    
    // Clear
    setInput('');
    setPreview(null);
    setHistoryIndex(-1);
    setShowConfirm(false);
    
    // Focus back to input
    inputRef.current?.focus();
  }, [preview, input, onAddBets]);

  // Calculate total
  const total = preview?.bets.reduce((sum, bet) => sum + bet.amount, 0) || 0;

  return (
    <>
      <Card className="border-accent/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-5 text-accent" />
            Smart Input
            <Button
              variant="ghost"
              size="icon"
              className="size-6 ml-auto"
              onClick={() => setShowHelp(true)}
            >
              <HelpCircle className="size-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Input */}
          <div className="relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์: 123x100x50, 12x100r, 5r19..."
              className={cn(
                "font-mono text-lg h-12",
                preview?.success === false && input.trim() && "border-red-500"
              )}
              disabled={disabled}
              autoFocus
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
              <Keyboard className="size-3" />
              <span>Enter</span>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className={cn(
              "rounded-lg p-3 text-sm",
              preview.success ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
            )}>
              {preview.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-500" />
                    <span className="text-green-400">
                      {preview.bets.length} รายการ | รวม {formatCurrency(total)}
                    </span>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="flex flex-wrap gap-1">
                      {preview.bets.slice(0, 20).map((bet, i) => (
                        <Badge key={i} variant="secondary" className="font-mono">
                          {bet.number} {formatBetType(bet.betType)} {bet.amount > 0 ? formatCurrency(bet.amount) : '-'}
                        </Badge>
                      ))}
                      {preview.bets.length > 20 && (
                        <Badge variant="outline">+{preview.bets.length - 20} รายการ</Badge>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-red-500" />
                  <span className="text-red-400">{preview.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput('');
                setPreview(null);
              }}
              disabled={!input}
            >
              <Trash2 className="size-4 mr-1" />
              ล้าง
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setShowConfirm(true)}
              disabled={!preview?.success || preview.bets.length === 0 || !preview.bets.every(b => b.amount > 0)}
            >
              <Send className="size-4 mr-1" />
              เพิ่มรายการ
            </Button>
          </div>

          {/* Keyboard hints */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> เพิ่ม
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> ล้าง
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> ประวัติ
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+Enter</kbd> เพิ่มทันที
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันเพิ่มรายการ</DialogTitle>
            <DialogDescription>
              {lotteryName} | {preview?.bets.length || 0} รายการ | รวม {formatCurrency(total)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-60">
            <div className="space-y-1">
              {preview?.bets.map((bet, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50">
                  <span className="font-mono">{bet.number}</span>
                  <span>{formatBetType(bet.betType)}</span>
                  <span className="font-medium">{formatCurrency(bet.amount)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              ยกเลิก
            </Button>
            <Button onClick={confirmAdd}>
              <CheckCircle className="size-4 mr-1" />
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>วิธีใช้ Smart Input</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">3 ตัว (บน + โต๊ด)</h4>
              <code className="bg-muted px-2 py-1 rounded">123x100x50</code>
              <p className="text-muted-foreground mt-1">→ 3ตัวบน 100, โต๊ด 50 (6 ตัว)</p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-1">2 ตัว (บน + ล่าง)</h4>
              <code className="bg-muted px-2 py-1 rounded">12x50x30</code>
              <p className="text-muted-foreground mt-1">→ 2ตัวบน 50, 2ตัวล่าง 30</p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-1">กลับเลข (r)</h4>
              <code className="bg-muted px-2 py-1 rounded">12x100r</code>
              <p className="text-muted-foreground mt-1">→ 12, 21 ตัวละ 100</p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-1">19 ประตู</h4>
              <code className="bg-muted px-2 py-1 rounded">5r19</code>
              <p className="text-muted-foreground mt-1">→ 05,15,25,35,45,50-59 (19 ตัว)</p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-1">หลายเลข</h4>
              <code className="bg-muted px-2 py-1 rounded">12,13,14x100</code>
              <p className="text-muted-foreground mt-1">→ 12, 13, 14 ตัวละ 100</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
