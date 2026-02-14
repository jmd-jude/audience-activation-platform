'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatNumber, formatCurrency, formatDecimal, formatPercent, getStatusColor, getUseCaseColor, truncate } from '@/lib/utils';
import { Eye, Copy, Pencil, Trash2, Rocket, ChevronDown, ChevronUp } from 'lucide-react';

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

interface Segment {
  id: string;
  segmentName: string;
  description: string;
  targetUseCase: string;
  status: string;
  estimatedSize?: number | null;
  usageCount: number;
  lastUsed?: Date | string | null;
  createdAt: Date | string;
  metrics?: SegmentMetrics | null;
}

interface SegmentCardProps {
  segment: Segment;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onClone?: (id: string) => void;
  onDelete?: (id: string) => void;
  onActivate?: (id: string) => void;
}

export function SegmentCard({ segment, onView, onEdit, onClone, onDelete, onActivate }: SegmentCardProps) {
  const [isMetricsExpanded, setIsMetricsExpanded] = useState(false);
  const hasMetrics = segment.metrics !== null && segment.metrics !== undefined;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{segment.segmentName}</CardTitle>
          <Badge className={getStatusColor(segment.status)}>{segment.status}</Badge>
        </div>
        <CardDescription>{truncate(segment.description, 120)}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getUseCaseColor(segment.targetUseCase)}>
              {segment.targetUseCase}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Estimated Size:</span>{' '}
              {segment.estimatedSize ? formatNumber(segment.estimatedSize) : 'N/A'}
            </div>
            <div>
              <span className="font-medium">Created:</span> {formatDate(segment.createdAt)}
            </div>
          </div>

          {/* Collapsible Performance Metrics */}
          {hasMetrics && (
            <div className="mt-3 pt-3 border-t">
              <button
                onClick={() => setIsMetricsExpanded(!isMetricsExpanded)}
                className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Performance Metrics</span>
                {isMetricsExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {isMetricsExpanded && segment.metrics && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    <span className="font-medium">Impressions:</span>{' '}
                    <span className="text-foreground">{formatNumber(segment.metrics.impressions)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">Clicks:</span>{' '}
                    <span className="text-foreground">{formatNumber(segment.metrics.clicks)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">Conversions:</span>{' '}
                    <span className="text-foreground">{formatNumber(segment.metrics.conversions)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">Spend:</span>{' '}
                    <span className="text-foreground">{formatCurrency(segment.metrics.spend)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">ROAS:</span>{' '}
                    <span className="text-foreground font-semibold">
                      {segment.metrics.roas !== null ? `${formatDecimal(segment.metrics.roas)}x` : 'N/A'}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">CTR:</span>{' '}
                    <span className="text-foreground">
                      {segment.metrics.ctr !== null ? formatPercent(segment.metrics.ctr) : 'N/A'}
                    </span>
                  </div>
                  <div className="text-muted-foreground col-span-2">
                    <span className="font-medium">Activations:</span>{' '}
                    <span className="text-foreground">
                      {segment.metrics.activeActivations} active / {segment.metrics.totalActivations} total
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="grid grid-cols-2 gap-2">
        {onView && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onView(segment.id)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        )}
        {onActivate && (segment.status === 'approved' || segment.status === 'active') && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onActivate(segment.id)}>
            <Rocket className="h-4 w-4 mr-1" />
            Activate
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onEdit(segment.id)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
        {onClone && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onClone(segment.id)}>
            <Copy className="h-4 w-4 mr-1" />
            Clone
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onDelete(segment.id)}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
