'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatDate,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDecimal,
  getPlatformColor,
  getActivationStatusColor
} from '@/lib/utils';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface LatestMetric {
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  spend: number | null;
  revenue: number | null;
  ctr: number | null;
  cpa: number | null;
  roas: number | null;
  conversionRate: number | null;
  periodStart: Date | string;
  periodEnd: Date | string;
}

interface ActivationCardProps {
  activation: {
    id: string;
    platform: string;
    platformName: string;
    externalAudienceId: string;
    audienceSize: number | null;
    status: string;
    activatedAt: Date | string;
    latestMetric?: LatestMetric | null;
  };
  onAddMetrics?: (activationId: string) => void;
  onViewMetrics?: (activationId: string) => void;
}

export function ActivationCard({ activation, onAddMetrics, onViewMetrics }: ActivationCardProps) {
  const { latestMetric } = activation;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{activation.platformName}</CardTitle>
          <div className="flex gap-1">
            <Badge className={getPlatformColor(activation.platform)}>
              {activation.platform}
            </Badge>
            <Badge className={getActivationStatusColor(activation.status)}>
              {activation.status}
            </Badge>
          </div>
        </div>
        <CardDescription className="font-mono text-xs">
          ID: {activation.externalAudienceId}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Audience Size:</span>{' '}
              {activation.audienceSize ? formatNumber(activation.audienceSize) : 'N/A'}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Activated:</span>{' '}
              {formatDate(activation.activatedAt)}
            </div>
          </div>

          {latestMetric ? (
            <>
              <div className="border-t pt-3 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Latest Performance ({formatDate(latestMetric.periodStart)} - {formatDate(latestMetric.periodEnd)})
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {latestMetric.impressions !== null && (
                    <div>
                      <span className="font-medium">Impressions:</span>{' '}
                      {formatNumber(latestMetric.impressions)}
                    </div>
                  )}
                  {latestMetric.clicks !== null && (
                    <div>
                      <span className="font-medium">Clicks:</span>{' '}
                      {formatNumber(latestMetric.clicks)}
                    </div>
                  )}
                  {latestMetric.conversions !== null && (
                    <div>
                      <span className="font-medium">Conversions:</span>{' '}
                      {formatNumber(latestMetric.conversions)}
                    </div>
                  )}
                  {latestMetric.spend !== null && (
                    <div>
                      <span className="font-medium">Spend:</span>{' '}
                      {formatCurrency(latestMetric.spend)}
                    </div>
                  )}
                  {latestMetric.ctr !== null && (
                    <div>
                      <span className="font-medium">CTR:</span>{' '}
                      {formatPercent(latestMetric.ctr)}
                    </div>
                  )}
                  {latestMetric.roas !== null && (
                    <div>
                      <span className="font-medium">ROAS:</span>{' '}
                      {formatDecimal(latestMetric.roas)}x
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="border-t pt-3 text-sm text-muted-foreground text-center py-2">
              No performance data yet
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {onAddMetrics && (
          <Button variant="default" size="sm" onClick={() => onAddMetrics(activation.id)}>
            <TrendingUp className="h-4 w-4 mr-1" />
            Add Metrics
          </Button>
        )}
        {onViewMetrics && (
          <Button variant="outline" size="sm" onClick={() => onViewMetrics(activation.id)}>
            <BarChart3 className="h-4 w-4 mr-1" />
            View History
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
