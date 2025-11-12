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
import { Loader2, Save, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

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

const useCases = ['Marketing', 'Sales', 'Analytics', 'Customer Acquisition', 'Retention'];

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const segmentId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [segmentName, setSegmentName] = useState('');
  const [description, setDescription] = useState('');
  const [targetUseCase, setTargetUseCase] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [estimatedSize, setEstimatedSize] = useState('');
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    fetchSegment();
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
      setStatus(segment.status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidationError(null);
    try {
      const response = await fetch('/api/validate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sqlQuery }),
      });

      const validation = await response.json();

      if (!validation.isValid) {
        setValidationError(validation.errors.join(', '));
        return false;
      }

      return true;
    } catch (err: any) {
      setValidationError('Validation failed');
      return false;
    }
  };

  const handleSave = async (newStatus?: string) => {
    setIsSaving(true);
    setError(null);

    try {
      // Validate SQL if approving
      if (newStatus === 'approved') {
        const isValid = await handleValidate();
        if (!isValid) {
          setIsSaving(false);
          return;
        }
      }

      const response = await fetch(`/api/segments/${segmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentName,
          description,
          targetUseCase,
          sqlQuery,
          estimatedSize: estimatedSize ? parseInt(estimatedSize) : null,
          status: newStatus || status,
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
          <Badge className={status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {status}
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {validationError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
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
                    {useCases.map((uc) => (
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
              Review and edit the SQL query. Make sure it follows best practices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SQLEditor
              value={sqlQuery}
              onChange={(value) => setSqlQuery(value || '')}
              height="400px"
            />
            <div className="mt-4">
              <Button variant="outline" onClick={handleValidate}>
                Validate SQL
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => handleSave()}
            disabled={isSaving || !segmentName || !description || !targetUseCase || !sqlQuery}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save as Draft
          </Button>

          <Button
            onClick={() => handleSave('approved')}
            disabled={isSaving || !segmentName || !description || !targetUseCase || !sqlQuery}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Approve & Save
          </Button>
        </div>
      </div>
    </div>
  );
}
