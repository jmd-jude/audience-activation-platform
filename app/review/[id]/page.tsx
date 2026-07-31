// app/review/[id]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SQLEditor } from '@/components/SQLEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertCircle, ArrowLeft, Rocket, Database, CheckCircle2 } from 'lucide-react';
import { ActivateSegmentDialog } from '@/components/ActivateSegmentDialog';
import { ActivationCard } from '@/components/ActivationCard';
import { PerformanceEntryForm } from '@/components/PerformanceEntryForm';
import { USE_CASES, SEGMENT_STATUSES } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';

interface Segment {
  id: string;
  segmentName: string;
  description: string;
  targetUseCase: string;
  sqlQuery: string;
  status: string;
  estimatedSize?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const segmentId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audience count-check state
  const [isCheckingCount, setIsCheckingCount] = useState(false);
  const [countResult, setCountResult] = useState<{
    audienceSize: number;
    executionTime: number;
    sampleData: {
      columns: Array<{ name: string; type: string }>;
      rows: Array<Record<string, unknown>>;
    };
  } | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  const [segmentName, setSegmentName] = useState('');
  const [description, setDescription] = useState('');
  const [targetUseCase, setTargetUseCase] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [estimatedSize, setEstimatedSize] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'draft' | 'approved' | 'published'>('draft');
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [activations, setActivations] = useState<any[]>([]);
  const [selectedActivationForMetrics, setSelectedActivationForMetrics] = useState<string | null>(null);

  useEffect(() => {
    fetchSegment();
    fetchActivations();
  }, [segmentId]);

  const fetchSegment = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/segments/${segmentId}`);
      if (!response.ok) throw new Error('Failed to fetch segment');

      const segment: Segment = await response.json();
      setSegmentName(segment.segmentName);
      setDescription(segment.description);
      setTargetUseCase(segment.targetUseCase);
      setSqlQuery(segment.sqlQuery);
      setEstimatedSize(segment.estimatedSize?.toString() || '');
      setSelectedStatus(segment.status as 'draft' | 'approved' | 'published');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivations = async () => {
    try {
      const response = await fetch(`/api/segments/${segmentId}/activations`);
      if (!response.ok) throw new Error('Failed to fetch activations');
      const data = await response.json();
      setActivations(data);
    } catch (err: any) {
      console.error('Error fetching activations:', err);
    }
  };

  const handleDeleteActivation = async (activationId: string) => {
    try {
      const response = await fetch(`/api/activations/${activationId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete activation');
      fetchActivations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCheckCount = async () => {
    if (!sqlQuery) return;

    setIsCheckingCount(true);
    setCountError(null);
    setCountResult(null);

    try {
      const response = await fetch('/api/snowflake/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sqlQuery }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Count check failed');
      }

      setCountResult(data.validation);
      setEstimatedSize(data.validation.audienceSize.toString());
    } catch (err: any) {
      setCountError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCheckingCount(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/segments/${segmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentName,
          description,
          targetUseCase,
          sqlQuery,
          estimatedSize: estimatedSize ? parseInt(estimatedSize) : null,
          status: selectedStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to save segment');

      // Redirect to library
      router.push('/library');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Review & Edit Segment</h1>
            <p className="text-muted-foreground">
              Review and modify the segment details before approval
            </p>
          </div>
          <Badge className={selectedStatus === 'approved' || selectedStatus === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Metadata Section */}
        <Card>
          <CardHeader>
            <CardTitle>Segment Metadata</CardTitle>
            <CardDescription>Basic information about the segment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="segmentName">
                Segment Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="segmentName"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="e.g., High-Value Tech Enthusiasts"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Clear description of who this targets and why"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetUseCase">
                  Target Use Case <span className="text-destructive">*</span>
                </Label>
                <Select value={targetUseCase} onValueChange={setTargetUseCase}>
                  <SelectTrigger id="targetUseCase">
                    <SelectValue placeholder="Select use case" />
                  </SelectTrigger>
                  <SelectContent>
                    {USE_CASES.map((uc) => (
                      <SelectItem key={uc} value={uc}>
                        {uc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedSize">Estimated Size (Optional)</Label>
                <Input
                  id="estimatedSize"
                  type="number"
                  value={estimatedSize}
                  onChange={(e) => setEstimatedSize(e.target.value)}
                  placeholder="e.g., 2500000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SQL Editor Section */}
        <Card>
          <CardHeader>
            <CardTitle>SQL Query</CardTitle>
            <CardDescription>
              Edit the query and re-check the count as you go — try loosening or tightening it to see how the audience size responds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SQLEditor
              value={sqlQuery}
              onChange={(value) => {
                setSqlQuery(value || '');
                // Clear stale count results when the SQL is edited
                if (countResult) setCountResult(null);
                if (countError) setCountError(null);
              }}
              height="400px"
            />
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={handleCheckCount}
                disabled={isCheckingCount || !sqlQuery}
              >
                {isCheckingCount ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Generate Counts
                  </>
                )}
              </Button>
            </div>

            {countResult && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Count Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Actual Size</p>
                      <p className="text-2xl font-bold">
                        {formatNumber(countResult.audienceSize)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Query Time</p>
                      <p className="text-2xl font-bold">
                        {(countResult.executionTime / 1000).toFixed(2)}s
                      </p>
                    </div>
                  </div>

                  {countResult.sampleData.rows.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Sample Records (first {countResult.sampleData.rows.length})
                      </h4>
                      <div className="border rounded-lg overflow-auto max-h-96">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              {countResult.sampleData.columns.map((col) => (
                                <th key={col.name} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                                  {col.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {countResult.sampleData.rows.map((row, idx) => (
                              <tr key={idx} className="border-t hover:bg-muted/50">
                                {countResult.sampleData.columns.map((col) => (
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

            {countError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{countError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Activations Section */}
        {(selectedStatus === 'approved' || selectedStatus === 'published') && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activations & Performance</CardTitle>
                  <CardDescription>
                    Platform activations and their performance metrics
                  </CardDescription>
                </div>
                <Button onClick={() => setIsActivateDialogOpen(true)}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Activate on Platform
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activations yet. Activate this segment on an advertising platform to start tracking performance.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activations.map((activation) => (
                    <ActivationCard
                      key={activation.id}
                      activation={activation}
                      onAddMetrics={(id) => setSelectedActivationForMetrics(id)}
                      onDelete={handleDeleteActivation}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Performance Entry Form (conditionally shown) */}
        {selectedActivationForMetrics && (
          <PerformanceEntryForm
            activationId={selectedActivationForMetrics}
            onSuccess={() => {
              setSelectedActivationForMetrics(null);
              fetchActivations();
            }}
            onCancel={() => setSelectedActivationForMetrics(null)}
          />
        )}

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Save Segment</CardTitle>
            <CardDescription>Choose a status and save your changes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="segmentStatus">Status</Label>
              <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <SelectTrigger id="segmentStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving || !segmentName || !description || !targetUseCase || !sqlQuery}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Segment
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Activate Dialog */}
      <ActivateSegmentDialog
        segmentId={segmentId}
        segmentName={segmentName}
        isOpen={isActivateDialogOpen}
        onClose={() => setIsActivateDialogOpen(false)}
        onSuccess={() => {
          setIsActivateDialogOpen(false);
          fetchActivations();
        }}
      />
    </div>
  );
}
