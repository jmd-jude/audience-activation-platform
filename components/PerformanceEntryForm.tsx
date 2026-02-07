'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { calculateMetrics, formatPercent, formatCurrency, formatDecimal } from '@/lib/utils';

interface PerformanceEntryFormProps {
  activationId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function PerformanceEntryForm({ activationId, onSuccess, onCancel }: PerformanceEntryFormProps) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodType, setPeriodType] = useState('custom');
  const [impressions, setImpressions] = useState('');
  const [clicks, setClicks] = useState('');
  const [conversions, setConversions] = useState('');
  const [spend, setSpend] = useState('');
  const [revenue, setRevenue] = useState('');
  const [matchRate, setMatchRate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate derived metrics for preview
  const derivedMetrics = calculateMetrics({
    impressions: impressions ? parseInt(impressions) : null,
    clicks: clicks ? parseInt(clicks) : null,
    conversions: conversions ? parseInt(conversions) : null,
    spend: spend ? parseFloat(spend) : null,
    revenue: revenue ? parseFloat(revenue) : null,
  });

  // Set default dates to last 7 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setPeriodStart(start.toISOString().split('T')[0]);
    setPeriodEnd(end.toISOString().split('T')[0]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodStart || !periodEnd) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/activations/${activationId}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          periodType,
          impressions: impressions ? parseInt(impressions) : null,
          clicks: clicks ? parseInt(clicks) : null,
          conversions: conversions ? parseInt(conversions) : null,
          spend: spend ? parseFloat(spend) : null,
          revenue: revenue ? parseFloat(revenue) : null,
          matchRate: matchRate ? parseFloat(matchRate) : null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save performance metrics');
      }

      // Reset form
      setImpressions('');
      setClicks('');
      setConversions('');
      setSpend('');
      setRevenue('');
      setMatchRate('');
      setNotes('');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Performance Metrics</CardTitle>
        <CardDescription>Add performance data for this activation</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Period Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodStart">
                Period Start <span className="text-destructive">*</span>
              </Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">
                Period End <span className="text-destructive">*</span>
              </Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="periodType">Period Type</Label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger id="periodType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="impressions">Impressions</Label>
              <Input
                id="impressions"
                type="number"
                value={impressions}
                onChange={(e) => setImpressions(e.target.value)}
                placeholder="e.g., 250000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clicks">Clicks</Label>
              <Input
                id="clicks"
                type="number"
                value={clicks}
                onChange={(e) => setClicks(e.target.value)}
                placeholder="e.g., 5000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="conversions">Conversions</Label>
              <Input
                id="conversions"
                type="number"
                value={conversions}
                onChange={(e) => setConversions(e.target.value)}
                placeholder="e.g., 150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matchRate">Match Rate (%)</Label>
              <Input
                id="matchRate"
                type="number"
                step="0.01"
                value={matchRate}
                onChange={(e) => setMatchRate(e.target.value)}
                placeholder="e.g., 78.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spend">Spend ($)</Label>
              <Input
                id="spend"
                type="number"
                step="0.01"
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
                placeholder="e.g., 12500.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue ($)</Label>
              <Input
                id="revenue"
                type="number"
                step="0.01"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                placeholder="e.g., 45000.00"
              />
            </div>
          </div>

          {/* Auto-Calculated Metrics Preview */}
          {(derivedMetrics.ctr !== null ||
            derivedMetrics.cpa !== null ||
            derivedMetrics.roas !== null ||
            derivedMetrics.conversionRate !== null) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Auto-Calculated Metrics:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {derivedMetrics.ctr !== null && (
                    <div>CTR: {formatPercent(derivedMetrics.ctr)}</div>
                  )}
                  {derivedMetrics.cpa !== null && (
                    <div>CPA: {formatCurrency(derivedMetrics.cpa)}</div>
                  )}
                  {derivedMetrics.roas !== null && (
                    <div>ROAS: {formatDecimal(derivedMetrics.roas)}x</div>
                  )}
                  {derivedMetrics.conversionRate !== null && (
                    <div>Conv. Rate: {formatPercent(derivedMetrics.conversionRate)}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context or observations..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={!periodStart || !periodEnd || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Save Metrics
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
