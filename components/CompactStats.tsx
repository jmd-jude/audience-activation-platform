import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatCurrency, formatDecimal } from '@/lib/utils';

interface CompactStatsProps {
  totalSegments: number;
  approvedSegments: number;
  draftSegments: number;
  totalAudienceSize: number;
  mostPopularUseCase: string;
  activeActivations: number;
  totalSpend: number;
  avgROAS: number;
}

export function CompactStats({
  totalSegments,
  approvedSegments,
  draftSegments,
  totalAudienceSize,
  mostPopularUseCase,
  activeActivations,
  totalSpend,
  avgROAS,
}: CompactStatsProps) {
  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          Platform Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-x-8 gap-y-4">
          {/* Row 1 */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Total Segments</div>
            <div className="text-2xl font-bold">{totalSegments}</div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Audience Size</div>
            <div className="text-2xl font-bold">{formatNumber(totalAudienceSize)}</div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Top Use Case</div>
            <div className="text-2xl font-bold">{mostPopularUseCase}</div>
          </div>

          {/* Row 2 - Only show if there are activations */}
          {activeActivations > 0 && (
            <>
              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground mb-1">Active Campaigns</div>
                <div className="text-2xl font-bold">{activeActivations}</div>
              </div>

              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground mb-1">Total Spend</div>
                <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
              </div>

              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground mb-1">Avg ROAS</div>
                <div className="text-2xl font-bold text-green-600">{formatDecimal(avgROAS)}x</div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
