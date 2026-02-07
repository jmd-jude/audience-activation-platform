'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDecimal
} from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';

interface PerformanceMetric {
  id: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  periodType: string;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  spend: number | null;
  revenue: number | null;
  ctr: number | null;
  cpa: number | null;
  roas: number | null;
  conversionRate: number | null;
  matchRate: number | null;
  notes: string | null;
}

interface PerformanceHistoryProps {
  metrics: PerformanceMetric[];
  onEdit?: (metricId: string) => void;
  onDelete?: (metricId: string) => void;
}

export function PerformanceHistory({ metrics, onEdit, onDelete }: PerformanceHistoryProps) {
  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No performance metrics recorded yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance History</CardTitle>
        <CardDescription>All recorded metrics for this activation</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium">
                    {formatDate(metric.periodStart)} - {formatDate(metric.periodEnd)}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {metric.periodType}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(metric.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(metric.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {metric.impressions !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Impressions</div>
                    <div className="font-medium">{formatNumber(metric.impressions)}</div>
                  </div>
                )}
                {metric.clicks !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Clicks</div>
                    <div className="font-medium">{formatNumber(metric.clicks)}</div>
                  </div>
                )}
                {metric.conversions !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Conversions</div>
                    <div className="font-medium">{formatNumber(metric.conversions)}</div>
                  </div>
                )}
                {metric.spend !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Spend</div>
                    <div className="font-medium">{formatCurrency(metric.spend)}</div>
                  </div>
                )}
                {metric.revenue !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Revenue</div>
                    <div className="font-medium">{formatCurrency(metric.revenue)}</div>
                  </div>
                )}
                {metric.ctr !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">CTR</div>
                    <div className="font-medium">{formatPercent(metric.ctr)}</div>
                  </div>
                )}
                {metric.cpa !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">CPA</div>
                    <div className="font-medium">{formatCurrency(metric.cpa)}</div>
                  </div>
                )}
                {metric.roas !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">ROAS</div>
                    <div className="font-medium">{formatDecimal(metric.roas)}x</div>
                  </div>
                )}
                {metric.conversionRate !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Conv. Rate</div>
                    <div className="font-medium">{formatPercent(metric.conversionRate)}</div>
                  </div>
                )}
                {metric.matchRate !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Match Rate</div>
                    <div className="font-medium">{formatPercent(metric.matchRate)}</div>
                  </div>
                )}
              </div>

              {metric.notes && (
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                  {metric.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
