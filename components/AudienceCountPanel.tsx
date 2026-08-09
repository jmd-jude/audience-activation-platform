// components/AudienceCountPanel.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Database, Wand2, CheckCircle2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export interface AudienceCountResult {
  audienceSize: number;
  executionTime: number;
  sampleData: {
    columns: Array<{ name: string; type: string }>;
    rows: Array<Record<string, unknown>>;
  };
}

interface AudienceCountPanelProps {
  isChecking: boolean;
  onCheck: () => void;
  checkDisabled?: boolean;
  checkingLabel?: string;
  result: AudienceCountResult | null;
  resultError: string | null;
  resultsTitle?: string;

  adjustInstruction: string;
  onAdjustInstructionChange: (value: string) => void;
  onAdjust: () => void;
  isAdjusting: boolean;
  adjustError: string | null;
  changeSummary: string | null;
}

export function AudienceCountPanel({
  isChecking,
  onCheck,
  checkDisabled,
  checkingLabel = 'Checking...',
  result,
  resultError,
  resultsTitle = 'Count Results',
  adjustInstruction,
  onAdjustInstructionChange,
  onAdjust,
  isAdjusting,
  adjustError,
  changeSummary,
}: AudienceCountPanelProps) {
  return (
    <div className="space-y-4">
      <Button
        onClick={onCheck}
        disabled={isChecking || checkDisabled}
        variant="secondary"
        className="w-full"
      >
        {isChecking ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {checkingLabel}
          </>
        ) : (
          <>
            <Database className="h-4 w-4 mr-2" />
            Generate Counts
          </>
        )}
      </Button>

      <div className="space-y-2">
        <Label htmlFor="adjustInstruction">Adjust This Audience</Label>
        <div className="flex gap-2">
          <Input
            id="adjustInstruction"
            value={adjustInstruction}
            onChange={(e) => onAdjustInstructionChange(e.target.value)}
            placeholder="e.g. grow this a bit but keep it focused on high-income households"
            disabled={isAdjusting}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isAdjusting && adjustInstruction.trim()) {
                e.preventDefault();
                onAdjust();
              }
            }}
          />
          <Button
            variant="secondary"
            onClick={onAdjust}
            disabled={isAdjusting || !adjustInstruction.trim()}
          >
            {isAdjusting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Describe how you&rsquo;d like the audience to change — the query updates and re-checks the count automatically.
        </p>
      </div>

      {changeSummary && (
        <Alert>
          <Wand2 className="h-4 w-4" />
          <AlertDescription>{changeSummary}</AlertDescription>
        </Alert>
      )}

      {adjustError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{adjustError}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {resultsTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Actual Size</p>
                <p className="text-2xl font-bold">{formatNumber(result.audienceSize)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Query Time</p>
                <p className="text-2xl font-bold">{(result.executionTime / 1000).toFixed(2)}s</p>
              </div>
            </div>

            {result.sampleData.rows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Sample Records (first {result.sampleData.rows.length})
                </h4>
                <div className="border rounded-lg overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {result.sampleData.columns.map((col) => (
                          <th key={col.name} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.sampleData.rows.map((row, idx) => (
                        <tr key={idx} className="border-t hover:bg-muted/50">
                          {result.sampleData.columns.map((col) => (
                            <td key={col.name} className="px-4 py-2 whitespace-nowrap">
                              {row[col.name]?.toString() || 'null'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {resultError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{resultError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
