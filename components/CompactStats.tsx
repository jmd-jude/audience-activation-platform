import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-3">
              Snapshot
              {!isOpen && (
                <span className="text-sm font-normal text-muted-foreground">
                  {totalSegments} Segments
                </span>
              )}
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    <span className="ml-2">Hide</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    <span className="ml-2">Show Stats</span>
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
