'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SegmentCard } from '@/components/SegmentCard';
import { formatNumber, formatDate, formatCurrency, formatDecimal } from '@/lib/utils';
import { Library, TrendingUp, Clock, Loader2, Lightbulb, Rocket, DollarSign, Sparkles } from 'lucide-react';

interface Segment {
  id: string;
  segmentName: string;
  description: string;
  targetUseCase: string;
  sqlQuery: string;
  status: string;
  estimatedSize?: number | null;
  usageCount: number;
  lastUsed?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Stats {
  total: number;
  approved: number;
  draft: number;
  totalAudienceSize: number;
  mostPopularUseCase: string;
}

interface PerformanceStats {
  totalActivations: number;
  activeActivations: number;
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalConversions: number;
  avgROAS: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    approved: 0,
    draft: 0,
    totalAudienceSize: 0,
    mostPopularUseCase: 'N/A',
  });
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    totalActivations: 0,
    activeActivations: 0,
    totalSpend: 0,
    totalRevenue: 0,
    totalImpressions: 0,
    totalConversions: 0,
    avgROAS: 0,
  });

  useEffect(() => {
    fetchSegments();
    fetchPerformanceOverview();
  }, []);

  const fetchSegments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/segments');
      if (!response.ok) throw new Error('Failed to fetch segments');

      const data: Segment[] = await response.json();
      setSegments(data);

      // Calculate stats
      const total = data.length;
      const approved = data.filter((s) => s.status === 'approved').length;
      const draft = data.filter((s) => s.status === 'draft').length;
      const totalAudienceSize = data.reduce((sum, s) => sum + (s.estimatedSize || 0), 0);

      // Find most popular use case
      const useCaseCounts: Record<string, number> = {};
      data.forEach((s) => {
        useCaseCounts[s.targetUseCase] = (useCaseCounts[s.targetUseCase] || 0) + 1;
      });
      const mostPopularUseCase =
        Object.entries(useCaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      setStats({
        total,
        approved,
        draft,
        totalAudienceSize,
        mostPopularUseCase,
      });
    } catch (err) {
      console.error('Error fetching segments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPerformanceOverview = async () => {
    try {
      const response = await fetch('/api/performance/overview');
      if (!response.ok) throw new Error('Failed to fetch performance overview');
      const data = await response.json();
      setPerformanceStats(data);
    } catch (err) {
      console.error('Error fetching performance overview:', err);
    }
  };

  const recentSegments = segments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 9);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Data Activation Platform
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Segments</CardTitle>
                <Library className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.approved} approved, {stats.draft} draft
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Audience Size</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.totalAudienceSize)}</div>
                <p className="text-xs text-muted-foreground">
                  Across all segments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Popular Use Case</CardTitle>
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.mostPopularUseCase}</div>
                <p className="text-xs text-muted-foreground">
                  Top segment category
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Stats */}
          {performanceStats.totalActivations > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                  <Rocket className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceStats.activeActivations}</div>
                  <p className="text-xs text-muted-foreground">
                    {performanceStats.totalActivations} total activations
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Campaign Spend</CardTitle>
                  <DollarSign className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(performanceStats.totalSpend)}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(performanceStats.totalImpressions)} impressions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg ROAS</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatDecimal(performanceStats.avgROAS)}x</div>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(performanceStats.totalConversions)} conversions
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Segments */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Recent Segments</h2>
              <Button variant="ghost" onClick={() => router.push('/library')}>
                View All
              </Button>
            </div>

            {recentSegments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center h-48">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No segments yet</p>
                  <Button onClick={() => router.push('/generate')}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Your First Segment
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentSegments.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    onView={(id) => router.push(`/review/${id}`)}
                    onEdit={(id) => router.push(`/review/${id}`)}
                    onClone={async (id) => {
                      const response = await fetch(`/api/segments/${id}/clone`, {
                        method: 'POST',
                      });
                      if (response.ok) {
                        const cloned = await response.json();
                        router.push(`/review/${cloned.id}`);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
