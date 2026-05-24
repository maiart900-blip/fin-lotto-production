'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, FileText, Loader2, Eye, Save } from 'lucide-react';

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ContentPagesPage() {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const res = await fetch('/api/content-pages');
      const data = await res.json();
      setPages(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (page: ContentPage) => {
    setEditingPage(page);
    setContent(page.content || '');
  };

  const handleSave = async () => {
    if (!editingPage) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/content-pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingPage.id, content }),
      });

      if (!res.ok) throw new Error('Failed');
      
      toast.success('บันทึกสำเร็จ');
      setEditingPage(null);
      fetchPages();
    } catch (error) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (page: ContentPage) => {
    try {
      const res = await fetch('/api/content-pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: page.id, is_active: !page.is_active }),
      });
      if (!res.ok) throw new Error('Failed');
      fetchPages();
    } catch (error) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown renderer
    return text
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-3">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mb-2">$1</h3>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-6 list-decimal">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-6 list-disc">$1</li>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n/gim, '<br/>');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">คู่มือ / กฎกติกา</h1>
        <p className="text-muted-foreground">แก้ไขเนื้อหาหน้าต่างๆ ที่แสดงให้ลูกค้า</p>
      </div>

      {editingPage ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>แก้ไข: {editingPage.title}</CardTitle>
                <CardDescription>Slug: {editingPage.slug}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                  <Eye className="size-4 mr-2" />
                  ดูตัวอย่าง
                </Button>
                <Button variant="outline" onClick={() => setEditingPage(null)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                  บันทึก
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                รองรับ Markdown: # หัวข้อ, ## หัวข้อรอง, **ตัวหนา**, *ตัวเอียง*, 1. รายการลำดับ, - รายการ
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="font-mono"
                placeholder="เขียนเนื้อหาที่นี่..."
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>หน้าเนื้อหาทั้งหมด</CardTitle>
            <CardDescription>ทั้งหมด {pages.length} หน้า</CardDescription>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="size-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีหน้าเนื้อหา</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>หน้า</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>อัปเดตล่าสุด</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{page.slug}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(page.updated_at).toLocaleString('th-TH')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={page.is_active}
                          onCheckedChange={() => handleToggle(page)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(page)}>
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage?.title}</DialogTitle>
            <DialogDescription>ตัวอย่างการแสดงผล</DialogDescription>
          </DialogHeader>
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
