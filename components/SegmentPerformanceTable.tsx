'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber, formatCurrency, formatDecimal, getUseCaseColor } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
  targetUseCase: string;
  estimatedSize?: number | null;
  metrics?: SegmentMetrics | null;
  activations?: Activation[];
}

interface SegmentPerformanceTableProps {
  segments: Segment[];
  maxRows?: number;
}

type SortField = 'segmentName' | 'targetUseCase' | 'estimatedSize' | 'activeActivations' | 'spend' | 'revenue' | 'roas';
type SortDirection = 'asc' | 'desc' | null;

export function SegmentPerformanceTable({ segments, maxRows = 15 }: SegmentPerformanceTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort segments
  const sortedSegments = [...segments].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'segmentName':
        aValue = a.segmentName.toLowerCase();
        bValue = b.segmentName.toLowerCase();
        break;
      case 'targetUseCase':
        aValue = a.targetUseCase.toLowerCase();
        bValue = b.targetUseCase.toLowerCase();
        break;
      case 'estimatedSize':
        aValue = a.estimatedSize || 0;
        bValue = b.estimatedSize || 0;
        break;
      case 'activeActivations':
        aValue = a.metrics?.activeActivations || 0;
        bValue = b.metrics?.activeActivations || 0;
        break;
      case 'spend':
        aValue = a.metrics?.spend || 0;
        bValue = b.metrics?.spend || 0;
        break;
      case 'revenue':
        aValue = a.metrics?.revenue || 0;
        bValue = b.metrics?.revenue || 0;
        break;
      case 'roas':
        aValue = a.metrics?.roas || 0;
        bValue = b.metrics?.roas || 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Limit rows
  const displayedSegments = sortedSegments.slice(0, maxRows);

  // Get active platforms for a segment
  const getActivePlatforms = (segment: Segment): string[] => {
    if (!segment.activations) return [];
    return segment.activations
      .filter((a) => a.status === 'active')
      .map((a) => a.platformName);
  };

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-transparent"
                onClick={() => handleSort('segmentName')}
              >
                Segment Name
                <SortIcon field="segmentName" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-transparent"
                onClick={() => handleSort('targetUseCase')}
              >
                Use Case
                <SortIcon field="targetUseCase" />
              </Button>
            </TableHead>
            <TableHead>Platforms</TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-transparent"
                onClick={() => handleSort('estimatedSize')}
              >
                Audience Size
                <SortIcon field="estimatedSize" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-transparent"
                onClick={() => handleSort('activeActivations')}
              >
                Active Campaigns
                <SortIcon field="activeActivations" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-transparent"
                onClick={() => handleSort('spend')}
              >
                Spend
                <SortIcon field="spend" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-transparent"
                onClick={() => handleSort('revenue')}
              >
                Revenue
                <SortIcon field="revenue" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-transparent"
                onClick={() => handleSort('roas')}
              >
                ROAS
                <SortIcon field="roas" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedSegments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground h-24">
                No segments with performance data
              </TableCell>
            </TableRow>
          ) : (
            displayedSegments.map((segment) => {
              const platforms = getActivePlatforms(segment);
              const hasMetrics = segment.metrics !== null && segment.metrics !== undefined;

              return (
                <TableRow
                  key={segment.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/review/${segment.id}`)}
                >
                  <TableCell className="font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/review/${segment.id}`);
                      }}
                      className="text-left hover:underline text-primary"
                    >
                      {segment.segmentName}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getUseCaseColor(segment.targetUseCase)}>
                      {segment.targetUseCase}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {platforms.length === 0 ? (
                      <span className="text-muted-foreground text-sm">—</span>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {platforms.map((platform, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {segment.estimatedSize ? formatNumber(segment.estimatedSize) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasMetrics && segment.metrics!.activeActivations > 0
                      ? segment.metrics!.activeActivations
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasMetrics && segment.metrics!.spend > 0
                      ? formatCurrency(segment.metrics!.spend)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasMetrics && segment.metrics!.revenue > 0
                      ? formatCurrency(segment.metrics!.revenue)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {hasMetrics && segment.metrics!.roas !== null
                      ? `${formatDecimal(segment.metrics!.roas)}x`
                      : '—'}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>
    </Card>
  );
}
