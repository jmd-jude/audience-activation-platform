'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SegmentPerformanceTable } from '@/components/SegmentPerformanceTable';
import { CompactStats } from '@/components/CompactStats';
import { DashboardFilters } from '@/components/DashboardFilters';
import { Loader2, Library, Sparkles } from 'lucide-react';

interface SegmentMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  roas: number | null;
  ctr: number | null;
  activeActivations: number;
  totalActivations: number;
}

interface Activation {
  platform: string;
  platformName: string;
  status: string;
}

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
  metrics?: SegmentMetrics | null;
  activations?: Activation[];
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
  const [selectedUseCase, setSelectedUseCase] = useState<string>('All');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
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
  }, [selectedUseCase, selectedPlatform]);

  const fetchSegments = async () => {
    setIsLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (selectedUseCase !== 'All') {
        params.append('useCase', selectedUseCase);
      }
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform);
      }

      const url = `/api/segments${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
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

      // Calculate performance stats from filtered segments
      let activeActivations = 0;
      let totalSpend = 0;
      let totalRevenue = 0;
      let segmentsWithMetrics = 0;

      data.forEach((segment) => {
        if (segment.metrics) {
          activeActivations += segment.metrics.activeActivations || 0;
          totalSpend += segment.metrics.spend || 0;
          totalRevenue += segment.metrics.revenue || 0;
          segmentsWithMetrics++;
        }
      });

      const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      setPerformanceStats({
        totalActivations: segmentsWithMetrics,
        activeActivations,
        totalSpend,
        totalRevenue,
        totalImpressions: 0,
        totalConversions: 0,
        avgROAS,
      });
    } catch (err) {
      console.error('Error fetching segments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPerformanceOverview = async () => {
    // Performance stats are now calculated from filtered segments in fetchSegments
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Graphent Platform by Audience Acuity
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Compact Stats */}
          <CompactStats
            totalSegments={stats.total}
            approvedSegments={stats.approved}
            draftSegments={stats.draft}
            totalAudienceSize={stats.totalAudienceSize}
            mostPopularUseCase={stats.mostPopularUseCase}
            activeActivations={performanceStats.activeActivations}
            totalSpend={performanceStats.totalSpend}
            avgROAS={performanceStats.avgROAS}
          />

          {/* Segment Performance Table */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Segment Performance</h2>
                <p className="text-sm text-muted-foreground">
                  Top performing segments across all platforms
                </p>
              </div>
              <Button variant="outline" onClick={() => router.push('/library')}>
                View All Segments
              </Button>
            </div>

            {/* Filter Controls */}
            <DashboardFilters
              selectedUseCase={selectedUseCase}
              selectedPlatform={selectedPlatform}
              onUseCaseChange={setSelectedUseCase}
              onPlatformChange={setSelectedPlatform}
            />

            {segments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center h-48">
                  <Library className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No segments yet</p>
                  <Button onClick={() => router.push('/generate')}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Your First Segment
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <SegmentPerformanceTable segments={segments} maxRows={15} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
