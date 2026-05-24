'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone, ExternalLink, Copy, Check, QrCode } from 'lucide-react';
import useSWR from 'swr';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ContactSettings {
  line_id?: string;
  line_url?: string;
  line_qr_url?: string;
  facebook_url?: string;
  telegram_url?: string;
  phone_number?: string;
  contact_message?: string;
}

export default function ContactPage() {
  const { data: settings } = useSWR<ContactSettings>('/api/site-settings', fetcher);
  const [copied, setCopied] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const openLine = () => {
    if (settings?.line_url) {
      window.open(settings.line_url, '_blank');
    } else if (settings?.line_id) {
      window.open(`https://line.me/ti/p/~${settings.line_id}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
          <MessageCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">ติดต่อแอดมิน</h1>
        <p className="text-muted-foreground mt-2">
          {settings?.contact_message || 'พร้อมให้บริการตลอด 24 ชั่วโมง'}
        </p>
      </div>

      {/* LINE Contact - Main */}
      {(settings?.line_id || settings?.line_url) && (
        <Card className="mb-4 border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-600/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-foreground">LINE Official</h3>
                {settings?.line_id && (
                  <p className="text-green-500 font-medium">@{settings.line_id}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={openLine}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                เพิ่มเพื่อน
              </Button>
              
              {settings?.line_id && (
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(`@${settings.line_id}`, 'line')}
                  className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                >
                  {copied === 'line' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              )}
              
              {settings?.line_qr_url && (
                <Button
                  variant="outline"
                  onClick={() => setShowQR(true)}
                  className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                >
                  <QrCode className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Contact Methods */}
      <div className="space-y-3">
        {settings?.phone_number && (
          <Card className="border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">โทรศัพท์</h3>
                    <p className="text-blue-500">{settings.phone_number}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(settings.phone_number!, 'phone')}
                    className="border-blue-500/50 text-blue-500"
                  >
                    {copied === 'phone' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-500 hover:bg-blue-600"
                    onClick={() => window.open(`tel:${settings.phone_number}`)}
                  >
                    โทร
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {settings?.telegram_url && (
          <Card className="border-sky-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Telegram</h3>
                    <p className="text-muted-foreground text-sm">แชทผ่าน Telegram</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-sky-500 hover:bg-sky-600"
                  onClick={() => window.open(settings.telegram_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  เปิด
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {settings?.facebook_url && (
          <Card className="border-blue-600/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Facebook</h3>
                    <p className="text-muted-foreground text-sm">แชทผ่าน Messenger</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => window.open(settings.facebook_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  เปิด
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* No Contact Info */}
      {!settings?.line_id && !settings?.line_url && !settings?.phone_number && !settings?.telegram_url && !settings?.facebook_url && (
        <Card className="border-muted">
          <CardContent className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2">ยังไม่มีช่องทางติดต่อ</h3>
            <p className="text-muted-foreground text-sm">กรุณาติดต่อทีมงานเพื่อขอข้อมูลการติดต่อ</p>
          </CardContent>
        </Card>
      )}

      {/* LINE QR Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">สแกน QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center p-4">
            {settings?.line_qr_url && (
              <img 
                src={settings.line_qr_url} 
                alt="LINE QR Code"
                className="w-64 h-64 rounded-lg border"
              />
            )}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              สแกน QR Code เพื่อเพิ่มเพื่อนใน LINE
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
