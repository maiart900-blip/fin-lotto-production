'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Newspaper, Clock, ChevronRight } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

export default function NewsPage() {
  const router = useRouter();
  const [news, setNews] = useState<Announcement[]>([]);
  const [selectedNews, setSelectedNews] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/announcements?active=true');
      const data = await res.json();
      setNews(data.announcements || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      info: { label: 'ข่าวสาร', color: 'bg-blue-500' },
      warning: { label: 'แจ้งเตือน', color: 'bg-orange-500' },
      success: { label: 'ข่าวดี', color: 'bg-green-500' },
      promo: { label: 'โปรโมชั่น', color: 'bg-pink-500' },
    };
    return types[type] || { label: 'ทั่วไป', color: 'bg-gray-500' };
  };

  if (selectedNews) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedNews(null)}>
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold line-clamp-1">{selectedNews.title}</h1>
          </div>
        </div>

        <div className="p-4">
          <Card>
            <CardContent className="p-6">
              <Badge className={getTypeBadge(selectedNews.type).color}>
                {getTypeBadge(selectedNews.type).label}
              </Badge>
              <h2 className="text-xl font-bold mt-3 mb-2">{selectedNews.title}</h2>
              <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(selectedNews.created_at)}
              </p>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{selectedNews.content}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">ข่าวสาร</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <Newspaper className="size-10" />
            <div>
              <h2 className="text-xl font-bold">ข่าวสารและประกาศ</h2>
              <p className="text-white/80 text-sm">อัพเดทข่าวสารล่าสุดจากเรา</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Newspaper className="size-16 text-gray-300 mb-4" />
              <p className="text-gray-500">ยังไม่มีข่าวสาร</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {news.map((item) => (
              <Card 
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedNews(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Badge className={`${getTypeBadge(item.type).color} mb-2`}>
                        {getTypeBadge(item.type).label}
                      </Badge>
                      <h3 className="font-semibold line-clamp-2 mb-1">{item.title}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-gray-400 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
