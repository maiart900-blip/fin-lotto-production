'use client';

import { useState, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface ConfirmItem {
  label: string;
  value: string | number;
  highlight?: boolean;
  type?: 'add' | 'deduct' | 'neutral';
}

interface PremiumConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description?: string;
  items: ConfirmItem[];
  confirmText?: string;
  cancelText?: string;
  warningMessage?: string;
  successMessage?: string;
  icon?: ReactNode;
}

export function PremiumConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  items,
  confirmText = 'ยืนยันลงระบบจริง',
  cancelText = 'ยกเลิก',
  warningMessage,
  successMessage = 'ดำเนินการสำเร็จ',
  icon,
}: PremiumConfirmModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleConfirm = async () => {
    if (isExecuting) return; // Prevent double-click
    
    setIsExecuting(true);
    
    try {
      await onConfirm();
      setIsSuccess(true);
      
      // Show success toast with premium styling
      toast.success(successMessage, {
        style: {
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '1px solid #22c55e',
          color: '#86efac',
        },
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      });
      
      // Close after brief success animation
      setTimeout(() => {
        setIsSuccess(false);
        setIsExecuting(false);
        onClose();
      }, 800);
    } catch (error) {
      setIsExecuting(false);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด', {
        style: {
          background: '#1a0a0a',
          border: '1px solid #dc2626',
          color: '#fca5a5',
        },
      });
    }
  };

  const handleClose = () => {
    if (isExecuting) return; // Prevent closing while executing
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-b from-[#0a0a0a] to-[#141414] border-2 border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
        {/* Gold glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none rounded-lg" />
        
        {/* Sparkle decorations */}
        <div className="absolute top-4 right-4 text-amber-400/30">
          <Sparkles className="w-5 h-5" />
        </div>
        
        <DialogHeader className="relative">
          <div className="flex items-center gap-3">
            {icon || (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/40 flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
            )}
            <div>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-amber-200/60 mt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Summary Items */}
        <div className="space-y-3 py-4">
          <div className="bg-black/40 rounded-xl p-4 border border-amber-500/20">
            <p className="text-xs text-amber-400/80 mb-3 font-medium flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              สรุปรายการที่จะดำเนินการ
            </p>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div 
                  key={index} 
                  className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                    item.highlight 
                      ? 'bg-amber-500/10 border border-amber-500/30' 
                      : 'bg-neutral-900/50'
                  }`}
                >
                  <span className="text-sm text-neutral-300">{item.label}</span>
                  <span className={`font-semibold ${
                    item.type === 'add' ? 'text-emerald-400' :
                    item.type === 'deduct' ? 'text-red-400' :
                    item.highlight ? 'text-amber-400' : 'text-white'
                  }`}>
                    {item.type === 'add' && '+'}
                    {item.type === 'deduct' && '-'}
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {warningMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{warningMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExecuting}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            {cancelText}
          </Button>
          
          <Button
            onClick={handleConfirm}
            disabled={isExecuting || isSuccess}
            className={`
              relative overflow-hidden min-w-[160px]
              ${isSuccess 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
                : 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500'
              }
              text-black font-bold
              shadow-[0_4px_20px_rgba(212,175,55,0.4)]
              hover:shadow-[0_4px_30px_rgba(212,175,55,0.6)]
              transition-all duration-300
              disabled:opacity-70 disabled:cursor-not-allowed
            `}
          >
            {/* Shine animation */}
            {!isExecuting && !isSuccess && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shine_2s_infinite]" />
            )}
            
            <span className="relative flex items-center gap-2">
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  สำเร็จ!
                </>
              ) : (
                confirmText
              )}
            </span>
          </Button>
        </DialogFooter>

        <style jsx global>{`
          @keyframes shine {
            0% { transform: translateX(-100%); }
            50%, 100% { transform: translateX(100%); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

// Hook for easy 3-stage confirmation flow
export function useThreeStageConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<PremiumConfirmModalProps, 'isOpen' | 'onClose'> | null>(null);

  const openConfirm = (modalConfig: Omit<PremiumConfirmModalProps, 'isOpen' | 'onClose'>) => {
    setConfig(modalConfig);
    setIsOpen(true);
  };

  const closeConfirm = () => {
    setIsOpen(false);
    setConfig(null);
  };

  const ConfirmModal = () => {
    if (!config) return null;
    return (
      <PremiumConfirmModal
        {...config}
        isOpen={isOpen}
        onClose={closeConfirm}
      />
    );
  };

  return { openConfirm, closeConfirm, ConfirmModal, isOpen };
}
