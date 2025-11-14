'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SegmentCard } from '@/components/SegmentCard';
import { formatNumber, formatDate } from '@/lib/utils';
import { Sparkles, Library, TrendingUp, CheckCircle2, Clock, Loader2, Lightbulb } from 'lucide-react';

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

  useEffect(() => {
    fetchSegments();
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

  const recentSegments = segments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the SIG Data Activation Platform
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                <CardTitle className="text-sm font-medium">Approved Segments</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.approved}</div>
                <p className="text-xs text-muted-foreground">
                  Ready for activation
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
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.mostPopularUseCase}</div>
                <p className="text-xs text-muted-foreground">
                  Top segment category
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => router.push('/discover')}>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Discover Audiences
                </Button>
                <Button onClick={() => router.push('/generate')} variant="outline">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate New Segment
                </Button>
                <Button variant="outline" onClick={() => router.push('/library')}>
                  <Library className="h-4 w-4 mr-2" />
                  Browse Library
                </Button>
              </div>
            </CardContent>
          </Card>

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
