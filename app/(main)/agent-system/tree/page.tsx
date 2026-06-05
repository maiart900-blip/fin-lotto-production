'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Users,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Crown,
  Shield,
  User,
  DollarSign,
  Percent,
  Loader2,
  Building2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Agent {
  id: string;
  code: string;
  name: string;
  level: number;
  parent_id: string | null;
  credit_limit: number;
  credit_used: number;
  commission_rate: number;
  position_taking: number;
  is_active: boolean;
  member_count?: number;
  children?: Agent[];
}

const LEVEL_COLORS = [
  { bg: 'from-amber-500 to-amber-600', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Master' },
  { bg: 'from-purple-500 to-purple-600', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Senior' },
  { bg: 'from-blue-500 to-blue-600', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Agent' },
  { bg: 'from-green-500 to-green-600', text: 'text-green-400', border: 'border-green-500/30', label: 'Sub-Agent' },
];

function AgentNode({ agent, depth = 0, isLast = false }: { agent: Agent; depth?: number; isLast?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = agent.children && agent.children.length > 0;
  const levelConfig = LEVEL_COLORS[Math.min(depth, LEVEL_COLORS.length - 1)];

  const formatMoney = (n: number) => new Intl.NumberFormat('th-TH').format(n);

  return (
    <div className="relative">
      {/* Connector Lines */}
      {depth > 0 && (
        <>
          <div className="absolute left-0 top-0 w-6 h-8 border-l-2 border-b-2 border-slate-700 rounded-bl-lg" />
          {!isLast && (
            <div className="absolute left-0 top-8 w-px h-full bg-slate-700" />
          )}
        </>
      )}

      <div className={cn('ml-6', depth === 0 && 'ml-0')}>
        {/* Agent Card */}
        <div
          className={cn(
            'relative p-4 rounded-xl border bg-gradient-to-br backdrop-blur-sm mb-2',
            'from-slate-900/90 to-slate-800/50',
            levelConfig.border,
            'hover:from-slate-800/90 hover:to-slate-700/50 transition-all duration-200'
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Expand Button */}
              {hasChildren && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 p-1 rounded hover:bg-slate-700/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              )}
              {!hasChildren && <div className="w-6" />}

              {/* Level Icon */}
              <div className={cn('p-2 rounded-lg bg-gradient-to-br', levelConfig.bg)}>
                {depth === 0 ? (
                  <Crown className="h-5 w-5 text-black" />
                ) : depth === 1 ? (
                  <Shield className="h-5 w-5 text-white" />
                ) : depth === 2 ? (
                  <Building2 className="h-5 w-5 text-white" />
                ) : (
                  <User className="h-5 w-5 text-white" />
                )}
              </div>

              {/* Agent Info */}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white">{agent.name}</h3>
                  <Badge variant="outline" className={cn('text-xs', levelConfig.text, levelConfig.border)}>
                    {levelConfig.label}
                  </Badge>
                  {!agent.is_active && (
                    <Badge variant="outline" className="text-red-400 border-red-500/30">
                      ปิดใช้งาน
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400 font-mono">{agent.code}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="flex items-center gap-1 text-amber-400">
                  <DollarSign className="h-3 w-3" />
                  <span className="font-bold">{formatMoney(agent.credit_limit - agent.credit_used)}</span>
                </div>
                <p className="text-xs text-slate-500">วงเงินคงเหลือ</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-purple-400">
                  <Percent className="h-3 w-3" />
                  <span className="font-bold">{agent.commission_rate}%</span>
                </div>
                <p className="text-xs text-slate-500">คอมมิชชั่น</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-blue-400">
                  <Percent className="h-3 w-3" />
                  <span className="font-bold">{agent.position_taking}%</span>
                </div>
                <p className="text-xs text-slate-500">PT</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-green-400">
                  <Users className="h-3 w-3" />
                  <span className="font-bold">{agent.member_count || 0}</span>
                </div>
                <p className="text-xs text-slate-500">สมาชิก</p>
              </div>
            </div>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="mt-2 space-y-2">
            {agent.children!.map((child, index) => (
              <AgentNode
                key={child.id}
                agent={child}
                depth={depth + 1}
                isLast={index === agent.children!.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentTreePage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data, mutate, isLoading } = useSWR('/api/agents/tree', fetcher, {
    refreshInterval: 60000,
  });

  const agentTree: Agent[] = data?.agents || [];

  // Filter function for search
  const filterAgents = (agents: Agent[], term: string): Agent[] => {
    if (!term) return agents;
    
    return agents
      .map(agent => {
        const matchesSelf = 
          agent.name?.toLowerCase().includes(term.toLowerCase()) ||
          agent.code?.toLowerCase().includes(term.toLowerCase());
        
        const filteredChildren = agent.children ? filterAgents(agent.children, term) : [];
        
        if (matchesSelf || filteredChildren.length > 0) {
          return {
            ...agent,
            children: matchesSelf ? agent.children : filteredChildren,
          };
        }
        return null;
      })
      .filter((agent): agent is Agent => agent !== null);
  };

  const filteredTree = filterAgents(agentTree, searchTerm);

  // Calculate stats
  const countAgents = (agents: Agent[]): number => {
    return agents.reduce((count, agent) => {
      return count + 1 + (agent.children ? countAgents(agent.children) : 0);
    }, 0);
  };

  const countByLevel = (agents: Agent[], level: number): number => {
    return agents.reduce((count, agent) => {
      const selfCount = agent.level === level ? 1 : 0;
      const childCount = agent.children ? countByLevel(agent.children, level) : 0;
      return count + selfCount + childCount;
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            โครงสร้างทีมเอเย่นต์ (4-Tier)
          </h1>
          <p className="text-amber-300/80">แผนภาพสายงานเอเย่นต์แบบลดหลั่น 4 ชั้น</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <Crown className="h-4 w-4" />
              <span className="text-xs">Master</span>
            </div>
            <p className="text-2xl font-bold text-amber-300">{countByLevel(agentTree, 1)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Senior</span>
            </div>
            <p className="text-2xl font-bold text-purple-300">{countByLevel(agentTree, 2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Building2 className="h-4 w-4" />
              <span className="text-xs">Agent</span>
            </div>
            <p className="text-2xl font-bold text-blue-300">{countByLevel(agentTree, 3)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <User className="h-4 w-4" />
              <span className="text-xs">Sub-Agent</span>
            </div>
            <p className="text-2xl font-bold text-green-300">{countByLevel(agentTree, 4)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">รวมทั้งหมด</span>
            </div>
            <p className="text-2xl font-bold text-slate-300">{countAgents(agentTree)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-black/90 border-slate-800">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ค้นหาเอเย่นต์ตามชื่อหรือรหัส..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-black/80 border-slate-700 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tree View */}
      <Card className="bg-black/90 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-amber-500" />
            แผนผังสายงาน
          </CardTitle>
          <CardDescription className="text-slate-400">
            คลิกที่ลูกศรเพื่อขยาย/ย่อสายงานย่อย
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-slate-400">กำลังโหลดข้อมูลสายงาน...</p>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <GitBranch className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">ไม่พบข้อมูลสายงาน</p>
              <p className="text-sm mt-1">ยังไม่มีเอเย่นต์ในระบบ หรือไม่พบตามคำค้นหา</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTree.map((agent, index) => (
                <AgentNode
                  key={agent.id}
                  agent={agent}
                  isLast={index === filteredTree.length - 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium text-white mb-4">คำอธิบาย</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {LEVEL_COLORS.map((level, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg bg-gradient-to-br', level.bg)}>
                  {index === 0 ? (
                    <Crown className="h-4 w-4 text-black" />
                  ) : index === 1 ? (
                    <Shield className="h-4 w-4 text-white" />
                  ) : index === 2 ? (
                    <Building2 className="h-4 w-4 text-white" />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                <div>
                  <p className={cn('font-medium', level.text)}>{level.label}</p>
                  <p className="text-xs text-slate-500">ระดับ {index + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
