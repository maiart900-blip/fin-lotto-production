'use client';

import { useState } from 'react';
import { 
  Book, Code, Copy, Check, Key, Lock, 
  Server, Globe, Zap, AlertCircle, ChevronDown, ChevronRight,
  Terminal, FileJson, Shield, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

// =====================================
// API Documentation for Child Sites
// =====================================
// เว็บลูกที่ต้องการใช้หน้าบ้านของตัวเอง (Custom UI)
// สามารถดึง API ไปเชื่อมต่อได้

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: boolean;
  category: string;
  requestBody?: string;
  responseExample?: string;
}

const API_ENDPOINTS: APIEndpoint[] = [
  // Authentication
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    description: 'เข้าสู่ระบบสมาชิก',
    auth: false,
    category: 'Authentication',
    requestBody: `{
  "phone": "0812345678",
  "password": "********",
  "site_id": "site-a"
}`,
    responseExample: `{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "phone": "0812345678",
      "username": "user123",
      "balance": 5000
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}`
  },
  {
    method: 'POST',
    path: '/api/v1/auth/register',
    description: 'สมัครสมาชิกใหม่',
    auth: false,
    category: 'Authentication',
    requestBody: `{
  "phone": "0812345678",
  "password": "********",
  "username": "user123",
  "site_id": "site-a",
  "referral_code": "ABC123"
}`,
    responseExample: `{
  "success": true,
  "data": {
    "user_id": "uuid",
    "message": "สมัครสมาชิกสำเร็จ"
  }
}`
  },
  
  // Lotteries
  {
    method: 'GET',
    path: '/api/v1/lotteries',
    description: 'ดึงรายการหวยที่เปิดรับ',
    auth: true,
    category: 'Lotteries',
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "หวยลาว",
      "status": "open",
      "close_at": "2024-01-15T18:00:00Z",
      "rates": {...}
    }
  ]
}`
  },
  {
    method: 'GET',
    path: '/api/v1/lotteries/{id}/rates',
    description: 'ดึงอัตราจ่ายของหวย',
    auth: true,
    category: 'Lotteries',
    responseExample: `{
  "success": true,
  "data": {
    "three_top": { "rate": 900, "min": 1, "max": 1000 },
    "three_tod": { "rate": 150, "min": 1, "max": 1000 },
    "two_top": { "rate": 90, "min": 1, "max": 5000 },
    "two_bottom": { "rate": 90, "min": 1, "max": 5000 }
  }
}`
  },
  
  // Betting
  {
    method: 'POST',
    path: '/api/v1/bets',
    description: 'ส่งโพยแทงหวย',
    auth: true,
    category: 'Betting',
    requestBody: `{
  "lottery_id": "uuid",
  "bets": [
    { "number": "123", "type": "three_top", "amount": 100 },
    { "number": "456", "type": "two_bottom", "amount": 50 }
  ]
}`,
    responseExample: `{
  "success": true,
  "data": {
    "slip_id": "uuid",
    "total_amount": 150,
    "bets_count": 2,
    "created_at": "2024-01-15T10:30:00Z"
  }
}`
  },
  {
    method: 'GET',
    path: '/api/v1/bets/history',
    description: 'ดูประวัติการแทง',
    auth: true,
    category: 'Betting',
    responseExample: `{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1
  }
}`
  },
  
  // Wallet
  {
    method: 'GET',
    path: '/api/v1/wallet/balance',
    description: 'ดูยอดเงินคงเหลือ',
    auth: true,
    category: 'Wallet',
    responseExample: `{
  "success": true,
  "data": {
    "balance": 5000,
    "pending_withdrawals": 0
  }
}`
  },
  {
    method: 'POST',
    path: '/api/v1/wallet/deposit',
    description: 'แจ้งฝากเงิน',
    auth: true,
    category: 'Wallet',
    requestBody: `{
  "amount": 1000,
  "slip_url": "https://...",
  "bank_ref": "..."
}`,
    responseExample: `{
  "success": true,
  "data": {
    "transaction_id": "uuid",
    "status": "pending"
  }
}`
  },
  {
    method: 'POST',
    path: '/api/v1/wallet/withdraw',
    description: 'ขอถอนเงิน',
    auth: true,
    category: 'Wallet',
    requestBody: `{
  "amount": 500,
  "bank_account": "xxx-x-xxxxx-x"
}`,
    responseExample: `{
  "success": true,
  "data": {
    "transaction_id": "uuid",
    "status": "pending"
  }
}`
  },
  
  // Results
  {
    method: 'GET',
    path: '/api/v1/results',
    description: 'ดูผลหวยย้อนหลัง',
    auth: false,
    category: 'Results',
    responseExample: `{
  "success": true,
  "data": [
    {
      "lottery_id": "uuid",
      "lottery_name": "หวยลาว",
      "draw_date": "2024-01-15",
      "results": {
        "first_prize": "123456",
        "two_bottom": "78"
      }
    }
  ]
}`
  },
  
  // Tenant
  {
    method: 'GET',
    path: '/api/v1/tenant/config',
    description: 'ดึงค่า config ของเว็บ',
    auth: false,
    category: 'Tenant',
    responseExample: `{
  "success": true,
  "data": {
    "site_id": "site-a",
    "site_name": "LOTTO A",
    "logo": "https://...",
    "primary_color": "#FFD700",
    "features": {...}
  }
}`
  },
];

export default function APIDocsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedEndpoints, setExpandedEndpoints] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categories = ['all', ...new Set(API_ENDPOINTS.map(e => e.category))];
  
  const filteredEndpoints = selectedCategory === 'all' 
    ? API_ENDPOINTS 
    : API_ENDPOINTS.filter(e => e.category === selectedCategory);

  const toggleEndpoint = (path: string) => {
    setExpandedEndpoints(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PUT': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'PATCH': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'DELETE': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            API Documentation
          </h1>
          <p className="text-slate-400 mt-1">เอกสาร API สำหรับเว็บลูกที่ต้องการทำ Custom UI</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Zap className="size-3 mr-1" />
            API v1.0
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Server className="size-3 mr-1" />
            REST API
          </Badge>
        </div>
      </div>

      {/* Quick Start */}
      <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-amber-300 flex items-center gap-2">
            <Terminal className="size-5" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Key className="size-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">1. ขอ API Key</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                ติดต่อแอดมินเว็บแม่เพื่อขอ API Key และ Site ID
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Lock className="size-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">2. Authentication</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                ส่ง API Key ใน Header ทุก Request
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Globe className="size-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-white">3. เริ่มใช้งาน</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                เรียก API ตาม Endpoint ที่ต้องการ
              </p>
            </div>
          </div>
          
          {/* Base URL */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Base URL</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7"
                onClick={() => copyToClipboard('https://api.finlotto.com/v1', 'base-url')}
              >
                {copiedCode === 'base-url' ? (
                  <Check className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
            <code className="text-amber-300 font-mono">https://api.finlotto.com/v1</code>
          </div>
          
          {/* Auth Header */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Authentication Header</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7"
                onClick={() => copyToClipboard('Authorization: Bearer {API_KEY}', 'auth-header')}
              >
                {copiedCode === 'auth-header' ? (
                  <Check className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
            <code className="text-blue-300 font-mono">Authorization: Bearer {'{API_KEY}'}</code>
            <br />
            <code className="text-blue-300 font-mono">X-Site-ID: {'{SITE_ID}'}</code>
          </div>
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-amber-300 flex items-center gap-2">
              <Book className="size-5" />
              API Endpoints
            </CardTitle>
            
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    selectedCategory === cat 
                      ? 'bg-amber-600 hover:bg-amber-500' 
                      : 'border-slate-600'
                  )}
                >
                  {cat === 'all' ? 'ทั้งหมด' : cat}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredEndpoints.map((endpoint) => (
              <div 
                key={endpoint.path}
                className="rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Endpoint Header */}
                <button
                  onClick={() => toggleEndpoint(endpoint.path)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Badge className={cn("font-mono text-xs px-2", getMethodColor(endpoint.method))}>
                      {endpoint.method}
                    </Badge>
                    <code className="text-white font-mono text-sm">{endpoint.path}</code>
                    {endpoint.auth && (
                      <Lock className="size-4 text-amber-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 hidden md:block">
                      {endpoint.description}
                    </span>
                    {expandedEndpoints.includes(endpoint.path) ? (
                      <ChevronDown className="size-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="size-5 text-slate-400" />
                    )}
                  </div>
                </button>
                
                {/* Endpoint Details */}
                {expandedEndpoints.includes(endpoint.path) && (
                  <div className="border-t border-slate-700 p-4 space-y-4 bg-black/30">
                    <p className="text-slate-300">{endpoint.description}</p>
                    
                    {endpoint.auth && (
                      <div className="flex items-center gap-2 text-amber-400 text-sm">
                        <Shield className="size-4" />
                        <span>Requires Authentication</span>
                      </div>
                    )}
                    
                    <Tabs defaultValue="request" className="w-full">
                      <TabsList className="bg-black/40">
                        {endpoint.requestBody && (
                          <TabsTrigger value="request">Request Body</TabsTrigger>
                        )}
                        {endpoint.responseExample && (
                          <TabsTrigger value="response">Response</TabsTrigger>
                        )}
                        <TabsTrigger value="curl">cURL</TabsTrigger>
                      </TabsList>
                      
                      {endpoint.requestBody && (
                        <TabsContent value="request" className="mt-4">
                          <div className="relative">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(endpoint.requestBody!, `req-${endpoint.path}`)}
                            >
                              {copiedCode === `req-${endpoint.path}` ? (
                                <Check className="size-3 text-emerald-400" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                            <pre className="p-4 rounded-lg bg-slate-900 text-sm font-mono text-emerald-300 overflow-x-auto">
                              {endpoint.requestBody}
                            </pre>
                          </div>
                        </TabsContent>
                      )}
                      
                      {endpoint.responseExample && (
                        <TabsContent value="response" className="mt-4">
                          <div className="relative">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(endpoint.responseExample!, `res-${endpoint.path}`)}
                            >
                              {copiedCode === `res-${endpoint.path}` ? (
                                <Check className="size-3 text-emerald-400" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                            <pre className="p-4 rounded-lg bg-slate-900 text-sm font-mono text-blue-300 overflow-x-auto">
                              {endpoint.responseExample}
                            </pre>
                          </div>
                        </TabsContent>
                      )}
                      
                      <TabsContent value="curl" className="mt-4">
                        <div className="relative">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(
                              `curl -X ${endpoint.method} "https://api.finlotto.com/v1${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-Site-ID: YOUR_SITE_ID" \\
  -H "Content-Type: application/json"${endpoint.requestBody ? ` \\
  -d '${endpoint.requestBody.replace(/\n/g, '')}'` : ''}`,
                              `curl-${endpoint.path}`
                            )}
                          >
                            {copiedCode === `curl-${endpoint.path}` ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                          <pre className="p-4 rounded-lg bg-slate-900 text-sm font-mono text-purple-300 overflow-x-auto whitespace-pre-wrap">
{`curl -X ${endpoint.method} "https://api.finlotto.com/v1${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-Site-ID: YOUR_SITE_ID" \\
  -H "Content-Type: application/json"${endpoint.requestBody ? ` \\
  -d '...'` : ''}`}
                          </pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Codes */}
      <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-amber-300 flex items-center gap-2">
            <AlertCircle className="size-5" />
            Error Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { code: 400, message: 'Bad Request', desc: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' },
              { code: 401, message: 'Unauthorized', desc: 'ไม่มี API Key หรือ Token หมดอายุ' },
              { code: 403, message: 'Forbidden', desc: 'ไม่มีสิทธิ์เข้าถึง' },
              { code: 404, message: 'Not Found', desc: 'ไม่พบข้อมูลที่ร้องขอ' },
              { code: 429, message: 'Too Many Requests', desc: 'เรียก API เกินจำนวนที่กำหนด' },
              { code: 500, message: 'Internal Server Error', desc: 'เกิดข้อผิดพลาดในระบบ' },
            ].map((error) => (
              <div 
                key={error.code}
                className="p-4 rounded-xl bg-black/30 border border-slate-700 flex items-start gap-4"
              >
                <Badge className={cn(
                  "font-mono",
                  error.code >= 500 ? "bg-red-500/20 text-red-400" :
                  error.code >= 400 ? "bg-amber-500/20 text-amber-400" :
                  "bg-blue-500/20 text-blue-400"
                )}>
                  {error.code}
                </Badge>
                <div>
                  <p className="font-medium text-white">{error.message}</p>
                  <p className="text-sm text-slate-400">{error.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-amber-300 flex items-center gap-2">
            <RefreshCw className="size-5" />
            Rate Limiting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-amber-300">1,000</p>
              <p className="text-slate-400">Requests / นาที</p>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-amber-300">100,000</p>
              <p className="text-slate-400">Requests / วัน</p>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-amber-300">10 MB</p>
              <p className="text-slate-400">Max Payload Size</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
