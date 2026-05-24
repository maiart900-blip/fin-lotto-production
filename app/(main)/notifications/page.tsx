'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Settings, CheckCircle, MessageSquare, AlertCircle, Trash2, Eye, EyeOff } from 'lucide-react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function NotificationsPage() {
  const { canAccess } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const { data: notifications, mutate: mutateNotifications } = useSWR('/api/notifications', fetcher);
  const { data: settings, mutate: mutateSettings } = useSWR('/api/notification-settings', fetcher);
  
  const [formData, setFormData] = useState({
    line_webhook_url: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    notify_new_deposit: true,
    notify_new_withdraw: true,
    notify_new_customer: true,
    notify_new_entry: true,
    notify_lottery_close: true,
    notify_high_amount: true,
    notify_result: true,
    notify_error: true,
    high_amount_threshold: 10000,
  });

  // Load settings into form when data arrives
  useState(() => {
    if (settings?.settings) {
      setFormData(prev => ({ ...prev, ...settings.settings }));
    }
  });

  if (!canAccess('admin')) {
    return (
      <div className="p-6">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-red-500">ไม่มีสิทธิ์เข้าถึง</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        toast.success('บันทึกการตั้งค่าสำเร็จ');
        mutateSettings();
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_read: true }),
      });
      mutateNotifications();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true }),
      });
      toast.success('อ่านทั้งหมดแล้ว');
      mutateNotifications();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const unreadCount = notifications?.notifications?.filter((n: { is_read: boolean }) => !n.is_read).length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">การแจ้งเตือน</h1>
          <p className="text-neutral-400">จัดการการแจ้งเตือนและตั้งค่า</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>
            <Eye className="h-4 w-4 mr-2" />
            อ่านทั้งหมด ({unreadCount})
          </Button>
        )}
      </div>

      <Tabs defaultValue="notifications">
        <TabsList className="bg-neutral-800">
          <TabsTrigger value="notifications" className="data-[state=active]:bg-neutral-700">
            <Bell className="h-4 w-4 mr-2" />
            การแจ้งเตือน
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-neutral-700">
            <Settings className="h-4 w-4 mr-2" />
            ตั้งค่า
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-4">
              {notifications?.notifications?.length > 0 ? (
                <div className="space-y-3">
                  {notifications.notifications.map((notif: { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string }) => (
                    <div 
                      key={notif.id} 
                      className={`rounded-lg p-4 flex justify-between items-start ${notif.is_read ? 'bg-neutral-800' : 'bg-neutral-800 border-l-4 border-blue-500'}`}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notif.type)}
                        <div>
                          <p className="font-semibold">{notif.title}</p>
                          <p className="text-sm text-neutral-400">{notif.message}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            {new Date(notif.created_at).toLocaleString('th-TH')}
                          </p>
                        </div>
                      </div>
                      {!notif.is_read && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleMarkAsRead(notif.id)}
                        >
                          <EyeOff className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto text-neutral-600 mb-3" />
                  <p className="text-neutral-500">ไม่มีการแจ้งเตือน</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          {/* LINE / Telegram Settings */}
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                ตั้งค่าช่องทางแจ้งเตือน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>LINE Webhook URL</Label>
                <Input
                  placeholder="https://notify-api.line.me/api/notify"
                  value={formData.line_webhook_url}
                  onChange={(e) => setFormData({ ...formData, line_webhook_url: e.target.value })}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telegram Bot Token</Label>
                  <Input
                    placeholder="123456:ABC-DEF..."
                    value={formData.telegram_bot_token}
                    onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                    className="bg-neutral-800 border-neutral-700"
                  />
                </div>
                <div>
                  <Label>Telegram Chat ID</Label>
                  <Input
                    placeholder="-1001234567890"
                    value={formData.telegram_chat_id}
                    onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                    className="bg-neutral-800 border-neutral-700"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Types */}
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle>ประเภทการแจ้งเตือน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'notify_new_deposit', label: 'แจ้งเตือนฝากเงินใหม่' },
                { key: 'notify_new_withdraw', label: 'แจ้งเตือนถอนเงินใหม่' },
                { key: 'notify_new_customer', label: 'แจ้งเตือนลูกค้าใหม่' },
                { key: 'notify_new_entry', label: 'แจ้งเตือนโพยใหม่' },
                { key: 'notify_lottery_close', label: 'แจ้งเตือนก่อนปิดรับ' },
                { key: 'notify_high_amount', label: 'แจ้งเตือนยอดสูง' },
                { key: 'notify_result', label: 'แจ้งเตือนผลหวย' },
                { key: 'notify_error', label: 'แจ้งเตือน Error' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <Switch
                    checked={formData[key as keyof typeof formData] as boolean}
                    onCheckedChange={(checked) => setFormData({ ...formData, [key]: checked })}
                  />
                </div>
              ))}
              
              <div>
                <Label>ยอดสูงกว่า (บาท)</Label>
                <Input
                  type="number"
                  value={formData.high_amount_threshold}
                  onChange={(e) => setFormData({ ...formData, high_amount_threshold: Number(e.target.value) })}
                  className="bg-neutral-800 border-neutral-700 w-48"
                />
              </div>
            </CardContent>
          </Card>

          <Button 
            onClick={handleSaveSettings} 
            disabled={isSaving}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
