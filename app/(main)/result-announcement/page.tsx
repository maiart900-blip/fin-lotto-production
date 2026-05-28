'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Bot,
  Send,
  MessageCircle,
  Facebook,
  Settings,
  Save,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  History,
  Copy,
  Star,
  Trash2,
  Users,
  Link,
  ExternalLink,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface BotSettings {
  id?: string;
  platform: string;
  is_enabled: boolean;
  line_notify_token?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  facebook_page_id?: string;
  facebook_access_token?: string;
  message_template: string;
  auto_announce: boolean;
  announce_delay_minutes: number;
}

interface AnnouncementLog {
  id: string;
  platform: string;
  status: string;
  message: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

interface LineEnvStatus {
  configured: boolean;
  token: string | null;
  groupId: string | null;
  status: {
    token: 'configured' | 'missing';
    groupId: 'configured' | 'missing';
  };
  message: string;
}

interface LineGroup {
  id: string;
  group_id: string;
  group_name: string | null;
  member_count: number | null;
  joined_at: string;
  last_activity_at: string;
  is_active: boolean;
  is_primary: boolean;
}

interface WebhookInfo {
  webhookUrl: string | null;
  instructions: string[];
}

const DEFAULT_TEMPLATE = `ผลหวย {lottery_name}
งวดวันที่ {draw_date}

รางวัลที่ 1: {prize_first}
เลขท้าย 2 ตัว: {prize_last2}
เลขท้าย 3 ตัว: {prize_last3}`;

const PLATFORMS = [
  { id: 'line', name: 'LINE Messaging API', icon: MessageCircle, color: 'bg-green-500' },
  { id: 'telegram', name: 'Telegram Bot', icon: Send, color: 'bg-blue-500' },
  { id: 'facebook', name: 'Facebook Page', icon: Facebook, color: 'bg-indigo-500' },
];

export default function ResultAnnouncementPage() {
  const { data: settings = [], mutate: mutateSettings, isLoading } = useSWR<BotSettings[]>('/api/bot-settings', fetcher);
  const { data: logs = [], mutate: mutateLogs } = useSWR<AnnouncementLog[]>('/api/announce-result?limit=20', fetcher);
  const { data: lineEnvStatus } = useSWR<LineEnvStatus>('/api/send-line', fetcher);
  const { data: lineGroupsData, mutate: mutateGroups } = useSWR<{ groups: LineGroup[] }>('/api/line/groups', fetcher);
  const { data: webhookInfo } = useSWR<WebhookInfo>('/api/line/webhook', fetcher);
  
  const lineGroups = lineGroupsData?.groups || [];
  
  const [activeTab, setActiveTab] = useState('line');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [testingGroupId, setTestingGroupId] = useState<string | null>(null);
  
  // Test announcement data
  const [testLotteryName, setTestLotteryName] = useState('หวยรัฐบาล');
  const [testTop3, setTestTop3] = useState('123');
  const [testBottom2, setTestBottom2] = useState('45');
  
  // Multi-group selection
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sendToAllGroups, setSendToAllGroups] = useState(true);
  
  // Add group manually
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`คัดลอก ${label} แล้ว`);
  };

  // Set primary group
  const handleSetPrimary = async (groupId: string) => {
    try {
      const res = await fetch('/api/line/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, action: 'set_primary' }),
      });
      
      if (res.ok) {
        toast.success('ตั้งเป็นกลุ่มหลักแล้ว');
        mutateGroups();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Delete group
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('ต้องการลบกลุ่มนี้?')) return;
    
    try {
      const res = await fetch('/api/line/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, action: 'delete' }),
      });
      
      if (res.ok) {
        toast.success('ลบกลุ่มแล้ว');
        mutateGroups();
        // Remove from selection if selected
        setSelectedGroups(prev => prev.filter(id => id !== groupId));
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Test send to specific group
  const handleTestSend = async (groupId: string) => {
    setTestingGroupId(groupId);
    try {
      const res = await fetch('/api/line/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, action: 'test_send' }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('ส่งข้อความทดสอบสำเร็จ');
        mutateGroups();
      } else {
        toast.error(data.error || 'ส่งไม่สำเร็จ');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setTestingGroupId(null);
    }
  };

  // Add group manually
  const handleAddGroup = async () => {
    if (!newGroupId.trim()) {
      toast.error('กรุณากรอก Group ID');
      return;
    }
    
    setIsAddingGroup(true);
    try {
      const res = await fetch('/api/line/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          group_id: newGroupId.trim(), 
          group_name: newGroupName.trim() || 'กลุ่มที่เพิ่มด้วยตนเอง',
          action: 'add' 
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('เพิ่มกลุ่มสำเร็จ');
        setNewGroupId('');
        setNewGroupName('');
        mutateGroups();
      } else {
        toast.error(data.error || 'เพิ่มไม่สำเร็จ');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsAddingGroup(false);
    }
  };

  // Toggle group selection
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Select/Deselect all groups
  const toggleSelectAll = () => {
    const activeGroups = lineGroups.filter(g => g.is_active).map(g => g.group_id);
    if (selectedGroups.length === activeGroups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(activeGroups);
    }
  };
  
  // Form states for each platform
  const [lineSettings, setLineSettings] = useState<BotSettings>({
    platform: 'line',
    is_enabled: false,
    line_notify_token: '',
    message_template: DEFAULT_TEMPLATE,
    auto_announce: false,
    announce_delay_minutes: 5,
  });
  
  const [telegramSettings, setTelegramSettings] = useState<BotSettings>({
    platform: 'telegram',
    is_enabled: false,
    telegram_bot_token: '',
    telegram_chat_id: '',
    message_template: DEFAULT_TEMPLATE,
    auto_announce: false,
    announce_delay_minutes: 5,
  });
  
  const [facebookSettings, setFacebookSettings] = useState<BotSettings>({
    platform: 'facebook',
    is_enabled: false,
    facebook_page_id: '',
    facebook_access_token: '',
    message_template: DEFAULT_TEMPLATE,
    auto_announce: false,
    announce_delay_minutes: 5,
  });

  // Load settings from API
  useEffect(() => {
    if (settings && settings.length > 0) {
      settings.forEach((s: BotSettings) => {
        if (s.platform === 'line') {
          setLineSettings({ ...lineSettings, ...s });
        } else if (s.platform === 'telegram') {
          setTelegramSettings({ ...telegramSettings, ...s });
        } else if (s.platform === 'facebook') {
          setFacebookSettings({ ...facebookSettings, ...s });
        }
      });
    }
  }, [settings]);

  const getCurrentSettings = () => {
    switch (activeTab) {
      case 'line': return lineSettings;
      case 'telegram': return telegramSettings;
      case 'facebook': return facebookSettings;
      default: return lineSettings;
    }
  };

  const setCurrentSettings = (newSettings: BotSettings) => {
    switch (activeTab) {
      case 'line': setLineSettings(newSettings); break;
      case 'telegram': setTelegramSettings(newSettings); break;
      case 'facebook': setFacebookSettings(newSettings); break;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentSettings = getCurrentSettings();
      const res = await fetch('/api/bot-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      await mutateSettings();
      toast.success(`บันทึกการตั้งค่า ${activeTab.toUpperCase()} สำเร็จ`);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const currentSettings = getCurrentSettings();
      let endpoint = '';
      let body = {};

      if (activeTab === 'line') {
        // ใช้ LINE Messaging API (Push Message)
        endpoint = '/api/send-line';
        body = { 
          customMessage: '🎉 ทดสอบการส่งข้อความ LINE Messaging API\n\nระบบพร้อมใช้งานแล้ว!',
        };
      } else if (activeTab === 'telegram') {
        endpoint = '/api/send-telegram';
        body = { 
          message: '🎉 ทดสอบการส่งข้อความ Telegram Bot', 
          bot_token: currentSettings.telegram_bot_token,
          chat_id: currentSettings.telegram_chat_id,
        };
      } else if (activeTab === 'facebook') {
        endpoint = '/api/send-facebook';
        body = { 
          message: '🎉 ทดสอบการโพสต์ Facebook Page', 
          page_id: currentSettings.facebook_page_id,
          access_token: currentSettings.facebook_access_token,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success('ส่งข้อความทดสอบสำเร็จ!');
      } else {
        toast.error(`ส่งไม่สำเร็จ: ${data.error || 'Unknown error'}`);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการทดสอบ');
    } finally {
      setIsTesting(false);
    }
  };

  // ประกาศผลจริง - รองรับหลายกลุ่ม
  const handleAnnounceResult = async () => {
    const activeGroups = lineGroups.filter(g => g.is_active);
    const targetGroups = sendToAllGroups 
      ? activeGroups.map(g => g.group_id)
      : selectedGroups;
    
    if (targetGroups.length === 0 && !sendToAllGroups) {
      toast.error('กรุณาเลือกกลุ่มที่ต้องการส่ง');
      return;
    }

    setIsAnnouncing(true);
    try {
      const resultDate = new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const res = await fetch('/api/send-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryName: testLotteryName,
          resultDate,
          top3: testTop3,
          bottom2: testBottom2,
          sendToAll: sendToAllGroups,
          groupIds: sendToAllGroups ? undefined : targetGroups,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(`ประกาศผลสำเร็จ ${data.stats?.success || 0}/${data.stats?.total || 0} กลุ่ม`);
        
        // บันทึกประวัติการประกาศ
        await fetch('/api/announce-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platforms: ['line'],
            lottery_name: testLotteryName,
            results: { top3: testTop3, bottom2: testBottom2 },
          }),
        });
        
        mutateLogs();
        mutateGroups();
      } else if (data.stats) {
        toast.error(`ส่งสำเร็จ ${data.stats.success}/${data.stats.total} กลุ่ม`);
      } else {
        toast.error(`ประกาศผลล้มเหลว: ${data.error || 'Unknown error'}`);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการประกาศผล');
    } finally {
      setIsAnnouncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="size-3 mr-1" /> สำเร็จ</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="size-3 mr-1" /> ล้มเหลว</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="size-3 mr-1" /> รอส่ง</Badge>;
    }
  };

  const currentSettings = getCurrentSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Bot className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-amber-400">บอทประกาศผลรางวัล</h1>
          <p className="text-neutral-400">ตั้งค่าการประกาศผลอัตโนมัติผ่าน LINE, Telegram, Facebook</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => {
          const platformSettings = settings?.find(s => s.platform === platform.id);
          const isEnabled = platformSettings?.is_enabled || false;
          return (
            <Card key={platform.id} className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-lg ${platform.color} flex items-center justify-center`}>
                    <platform.icon className="size-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{platform.name}</p>
                    <p className="text-sm text-neutral-400">
                      {isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </p>
                  </div>
                  <Badge className={isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-neutral-700 text-neutral-400'}>
                    {isEnabled ? 'ON' : 'OFF'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Settings Tabs */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Settings className="size-5 text-amber-400" />
            ตั้งค่าบอท
          </CardTitle>
          <CardDescription>กรอกข้อมูล Token และ API Key สำหรับแต่ละแพลตฟอร์ม</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-6 bg-neutral-800">
              <TabsTrigger value="line" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <MessageCircle className="size-4 mr-2" /> LINE
              </TabsTrigger>
              <TabsTrigger value="telegram" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <Send className="size-4 mr-2" /> Telegram
              </TabsTrigger>
              <TabsTrigger value="facebook" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                <Facebook className="size-4 mr-2" /> Facebook
              </TabsTrigger>
            </TabsList>

            {/* LINE Settings */}
            <TabsContent value="line" className="space-y-4">
              {/* Webhook URL Card */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h4 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                  <Link className="size-4" />
                  LINE Webhook URL
                </h4>
                <div className="flex items-center gap-2">
                  <Input
                    value={webhookInfo?.webhookUrl || 'กำลังโหลด...'}
                    readOnly
                    className="bg-neutral-800 border-neutral-700 text-white font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => webhookInfo?.webhookUrl && copyToClipboard(webhookInfo.webhookUrl, 'Webhook URL')}
                    className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-neutral-400 mt-2">
                  นำ URL นี้ไปตั้งค่าใน LINE Developers Console &gt; Messaging API &gt; Webhook URL
                </p>
              </div>

              {/* LINE Groups Card */}
              <div className="p-4 bg-neutral-800 rounded-lg border border-neutral-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <Users className="size-4 text-green-400" />
                    LINE Groups ({lineGroups.filter(g => g.is_active).length} กลุ่ม)
                  </h4>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => mutateGroups()}
                      className="text-neutral-400 hover:text-white"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Add Group Manually */}
                <div className="p-3 bg-neutral-900 rounded-lg mb-3">
                  <p className="text-xs text-neutral-400 mb-2">เพิ่มกลุ่มด้วยตนเอง</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Group ID (Cxxxx...)"
                      value={newGroupId}
                      onChange={(e) => setNewGroupId(e.target.value)}
                      className="bg-neutral-800 border-neutral-700 text-white text-sm flex-1"
                    />
                    <Input
                      placeholder="ชื่อกลุ่ม (ไม่บังคับ)"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="bg-neutral-800 border-neutral-700 text-white text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddGroup}
                      disabled={isAddingGroup || !newGroupId.trim()}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isAddingGroup ? <Loader2 className="size-4 animate-spin" /> : 'เพิ่ม'}
                    </Button>
                  </div>
                </div>
                
                {lineGroups.length === 0 ? (
                  <div className="text-center py-6 text-neutral-500">
                    <Users className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">ยังไม่มีกลุ่ม LINE</p>
                    <p className="text-xs mt-1">นำ Bot เข้ากลุ่มเพื่อดึง Group ID อัตโนมัติ หรือเพิ่มด้วยตนเอง</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lineGroups.map((group) => (
                      <div
                        key={group.id}
                        className={`p-3 rounded-lg border ${
                          group.is_primary 
                            ? 'bg-green-500/10 border-green-500/30' 
                            : group.is_active
                              ? 'bg-neutral-900 border-neutral-700'
                              : 'bg-neutral-900/50 border-neutral-800 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Checkbox for selection */}
                            {!sendToAllGroups && group.is_active && (
                              <input
                                type="checkbox"
                                checked={selectedGroups.includes(group.group_id)}
                                onChange={() => toggleGroupSelection(group.group_id)}
                                className="size-4 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {group.group_name || 'ไม่ทราบชื่อกลุ่ม'}
                                </span>
                                {group.is_primary && (
                                  <Badge className="bg-green-500 text-white text-xs">
                                    <Star className="size-3 mr-1" /> หลัก
                                  </Badge>
                                )}
                                {!group.is_active && (
                                  <Badge variant="destructive" className="text-xs">ปิดใช้งาน</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-neutral-400">
                                <span className="font-mono">{group.group_id.slice(0, 20)}...</span>
                                {group.member_count && (
                                  <span>{group.member_count} สมาชิก</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Test Send Button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTestSend(group.group_id)}
                              disabled={testingGroupId === group.group_id || !group.is_active}
                              className="text-blue-400 hover:text-blue-300"
                              title="ทดสอบส่งข้อความ"
                            >
                              {testingGroupId === group.group_id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Send className="size-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(group.group_id, 'Group ID')}
                              className="text-neutral-400 hover:text-white"
                              title="คัดลอก Group ID"
                            >
                              <Copy className="size-4" />
                            </Button>
                            {!group.is_primary && group.is_active && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSetPrimary(group.group_id)}
                                className="text-amber-400 hover:text-amber-300"
                                title="ตั้งเป็นกลุ่มหลัก"
                              >
                                <Star className="size-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteGroup(group.group_id)}
                              className="text-red-400 hover:text-red-300"
                              title="ลบกลุ่ม"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ENV Status Card */}
              <div className="p-4 bg-neutral-800 rounded-lg border border-neutral-700">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Settings className="size-4 text-amber-400" />
                  สถานะการตั้งค่า Environment Variables
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    {lineEnvStatus?.status?.token === 'configured' ? (
                      <CheckCircle className="size-4 text-green-400" />
                    ) : (
                      <XCircle className="size-4 text-red-400" />
                    )}
                    <span className="text-sm text-neutral-300">LINE_CHANNEL_ACCESS_TOKEN:</span>
                    <span className="text-sm font-mono">
                      {lineEnvStatus?.token || <span className="text-red-400">ยังไม่ได้ตั้งค่า</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {lineEnvStatus?.status?.groupId === 'configured' ? (
                      <CheckCircle className="size-4 text-green-400" />
                    ) : (
                      <XCircle className="size-4 text-red-400" />
                    )}
                    <span className="text-sm text-neutral-300">LINE_GROUP_ID:</span>
                    <span className="text-sm font-mono">
                      {lineEnvStatus?.groupId || <span className="text-red-400">ยังไม่ได้ตั้งค่า</span>}
                    </span>
                  </div>
                </div>
                {!lineEnvStatus?.configured && (
                  <p className="text-xs text-amber-400 mt-3">
                    * ต้องตั้งค่า ENV บน Vercel Dashboard &gt; Settings &gt; Environment Variables
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
                <div>
                  <Label className="text-white">เปิดใช้งาน LINE Messaging API</Label>
                  <p className="text-sm text-neutral-400">ส่งข้อความประกาศผลผ่าน LINE (Push Message)</p>
                </div>
                <Switch
                  checked={lineSettings.is_enabled}
                  onCheckedChange={(checked) => setLineSettings({ ...lineSettings, is_enabled: checked })}
                />
              </div>

              {/* ข้อมูลทดสอบประกาศผล */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-4">
                <h4 className="font-medium text-green-400 flex items-center gap-2">
                  <MessageCircle className="size-4" />
                  ประกาศผลหวย
                </h4>
                
                {/* Target Selection */}
                <div className="p-3 bg-neutral-900 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-white">เป้าหมายการส่ง</Label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={sendToAllGroups}
                          onChange={() => setSendToAllGroups(true)}
                          className="text-green-500 focus:ring-green-500"
                        />
                        <span className="text-sm text-neutral-300">ส่งทุกกลุ่ม ({lineGroups.filter(g => g.is_active).length})</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!sendToAllGroups}
                          onChange={() => setSendToAllGroups(false)}
                          className="text-green-500 focus:ring-green-500"
                        />
                        <span className="text-sm text-neutral-300">เลือกกลุ่ม ({selectedGroups.length})</span>
                      </label>
                    </div>
                  </div>
                  {!sendToAllGroups && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">เลือกกลุ่มในรายการด้านบน หรือ</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={toggleSelectAll}
                        className="text-green-400 hover:text-green-300 h-6 text-xs"
                      >
                        {selectedGroups.length === lineGroups.filter(g => g.is_active).length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm text-neutral-400">ชื่อหวย</Label>
                    <Input
                      value={testLotteryName}
                      onChange={(e) => setTestLotteryName(e.target.value)}
                      placeholder="หวยรัฐบาล"
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-neutral-400">3 ตัวบน</Label>
                    <Input
                      value={testTop3}
                      onChange={(e) => setTestTop3(e.target.value)}
                      placeholder="123"
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-neutral-400">2 ตัวล่าง</Label>
                    <Input
                      value={testBottom2}
                      onChange={(e) => setTestBottom2(e.target.value)}
                      placeholder="45"
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAnnounceResult}
                  disabled={isAnnouncing || !lineEnvStatus?.configured || (!sendToAllGroups && selectedGroups.length === 0)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isAnnouncing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
                  {sendToAllGroups 
                    ? `ประกาศผลทุกกลุ่ม (${lineGroups.filter(g => g.is_active).length} กลุ่ม)`
                    : `ประกาศผล ${selectedGroups.length} กลุ่มที่เลือก`
                  }
                </Button>
              </div>

              {/* คำแนะนำการใช้งาน */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <h4 className="font-medium text-amber-400 mb-2">คำแนะนำการตั้งค่า LINE Messaging API</h4>
                <ol className="text-sm text-neutral-400 space-y-1 list-decimal list-inside">
                  <li>สร้าง LINE Official Account ที่ manager.line.biz</li>
                  <li>เปิดใช้งาน Messaging API ที่ developers.line.biz</li>
                  <li>คัดลอก Channel Access Token มาตั้งค่าใน ENV</li>
                  <li>นำ LINE Bot เข้าไปในกลุ่มที่ต้องการส่งข้อความ</li>
                  <li>หา Group ID โดยใช้ Webhook หรือ API</li>
                </ol>
              </div>
            </TabsContent>

            {/* Telegram Settings */}
            <TabsContent value="telegram" className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
                <div>
                  <Label className="text-white">เปิดใช้งาน Telegram Bot</Label>
                  <p className="text-sm text-neutral-400">ส่งข้อความประกาศผลผ่าน Telegram</p>
                </div>
                <Switch
                  checked={telegramSettings.is_enabled}
                  onCheckedChange={(checked) => setTelegramSettings({ ...telegramSettings, is_enabled: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Bot Token</Label>
                <Input
                  type="password"
                  placeholder="กรอก Bot Token จาก @BotFather"
                  value={telegramSettings.telegram_bot_token || ''}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, telegram_bot_token: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Chat ID / Channel ID</Label>
                <Input
                  placeholder="กรอก Chat ID หรือ Channel ID"
                  value={telegramSettings.telegram_chat_id || ''}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, telegram_chat_id: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
                <p className="text-xs text-neutral-500">ใช้ @userinfobot เพื่อดู Chat ID</p>
              </div>
            </TabsContent>

            {/* Facebook Settings */}
            <TabsContent value="facebook" className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
                <div>
                  <Label className="text-white">เปิดใช้งาน Facebook Page</Label>
                  <p className="text-sm text-neutral-400">โพสต์ประกาศผลบน Facebook Page</p>
                </div>
                <Switch
                  checked={facebookSettings.is_enabled}
                  onCheckedChange={(checked) => setFacebookSettings({ ...facebookSettings, is_enabled: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Page ID</Label>
                <Input
                  placeholder="กรอก Facebook Page ID"
                  value={facebookSettings.facebook_page_id || ''}
                  onChange={(e) => setFacebookSettings({ ...facebookSettings, facebook_page_id: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Page Access Token</Label>
                <Input
                  type="password"
                  placeholder="กรอก Page Access Token"
                  value={facebookSettings.facebook_access_token || ''}
                  onChange={(e) => setFacebookSettings({ ...facebookSettings, facebook_access_token: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
                <p className="text-xs text-neutral-500">รับ Token จาก Facebook Developer Console</p>
              </div>
            </TabsContent>

            {/* Common Settings - Message Template */}
            <div className="mt-6 pt-6 border-t border-neutral-800 space-y-4">
              <div className="space-y-2">
                <Label className="text-white">รูปแบบข้อความ (Message Template)</Label>
                <Textarea
                  rows={6}
                  placeholder="กรอกรูปแบบข้อความ..."
                  value={currentSettings.message_template}
                  onChange={(e) => setCurrentSettings({ ...currentSettings, message_template: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white font-mono text-sm"
                />
                <p className="text-xs text-neutral-500">
                  ตัวแปรที่ใช้ได้: {'{lottery_name}'}, {'{draw_date}'}, {'{prize_first}'}, {'{prize_last2}'}, {'{prize_last3}'}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
                <div>
                  <Label className="text-white">ประกาศผลอัตโนมัติ</Label>
                  <p className="text-sm text-neutral-400">ส่งข้อความทันทีเมื่อมีการบันทึกผลรางวัล</p>
                </div>
                <Switch
                  checked={currentSettings.auto_announce}
                  onCheckedChange={(checked) => setCurrentSettings({ ...currentSettings, auto_announce: checked })}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              >
                {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                บันทึกการตั้งค่า
              </Button>
              <Button
                onClick={handleTest}
                disabled={isTesting}
                variant="outline"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
              >
                {isTesting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <TestTube className="size-4 mr-2" />}
                ทดสอบส่ง
              </Button>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Announcement Logs */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <History className="size-5 text-amber-400" />
                ประวัติการประกาศผล
              </CardTitle>
              <CardDescription>รายการประกาศผลล่าสุด 20 รายการ</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutateLogs()}
              className="border-neutral-700 text-neutral-400 hover:text-white"
            >
              <RefreshCw className="size-4 mr-2" />
              รีเฟรช
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              ยังไม่มีประวัติการประกาศผล
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-4 bg-neutral-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        log.platform === 'line' ? 'bg-green-500/20 text-green-400' :
                        log.platform === 'telegram' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-indigo-500/20 text-indigo-400'
                      }>
                        {log.platform.toUpperCase()}
                      </Badge>
                      {getStatusBadge(log.status)}
                    </div>
                    <span className="text-xs text-neutral-500">
                      {new Date(log.created_at).toLocaleString('th-TH')}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 line-clamp-2">{log.message}</p>
                  {log.error_message && (
                    <p className="text-xs text-red-400 mt-1">{log.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
