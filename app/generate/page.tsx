// app/generate/page.tsx

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GenerateForm } from '@/components/GenerateForm';
import { SQLEditor } from '@/components/SQLEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Save, Eye, Sparkles, Database } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface GeneratedSegment {
  segmentName: string;
  description: string;
  sqlQuery: string;
  reasoning?: string;
  confidence?: number;
  useCase?: string;
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

function GeneratePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [generatedSegment, setGeneratedSegment] = useState<GeneratedSegment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveryData, setDiscoveryData] = useState<{
    audienceName: string;
    naturalLanguageInput: string;
    useCase: string;
    additionalContext: string;
  } | null>(null);

  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<{
    audienceSize: number;
    executionTime: number;
    sampleData: {
      columns: Array<{ name: string; type: string }>;
      rows: Array<Record<string, unknown>>;
    };
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check for discovery parameter on mount
  useEffect(() => {
    const discoveryParam = searchParams.get('discovery');
    console.log('Discovery param from URL:', discoveryParam);
    if (discoveryParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(discoveryParam));
        console.log('Parsed discovery data:', parsed);
        setDiscoveryData(parsed);
      } catch (err) {
        console.error('Failed to parse discovery data:', err);
      }
    }
  }, [searchParams]);

  const handleGenerate = async (data: {
    naturalLanguageInput: string;
    useCase: string;
    additionalContext?: string;
  }) => {
    setError(null);
    try {
      const response = await fetch('/api/generate-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate segment');
      }

      const result = await response.json();
      setGeneratedSegment({ ...result, useCase: data.useCase });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleValidate = async () => {
    if (!generatedSegment?.sqlQuery) return;

    setIsValidating(true);
    setValidationError(null);
    setValidationResults(null);

    try {
      const response = await fetch('/api/snowflake/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sqlQuery: generatedSegment.sqlQuery
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }

      setValidationResults(data.validation);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async (status: 'draft' | 'approved') => {
    if (!generatedSegment) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentName: generatedSegment.segmentName,
          description: generatedSegment.description,
          targetUseCase: generatedSegment.useCase,
          sqlQuery: generatedSegment.sqlQuery,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save segment');
      }

      const savedSegment = await response.json();

      if (status === 'draft') {
        router.push(`/review/${savedSegment.id}`);
      } else {
        router.push('/library');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generate Audience Segment</h1>
        <p className="text-muted-foreground">
          Describe your target audience
        </p>
      </div>

      {/* Discovery Banner */}
      {discoveryData && (
        <Alert className="mb-6 bg-primary/5 border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription>
            <span className="font-medium">Refining audience:</span> {discoveryData.audienceName}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Input Form */}
        <div>
          <GenerateForm
            onGenerate={handleGenerate}
            initialValues={discoveryData ? {
              naturalLanguageInput: discoveryData.naturalLanguageInput,
              useCase: discoveryData.useCase,
              additionalContext: discoveryData.additionalContext,
            } : undefined}
          />
        </div>

        {/* Right Column: Generated Output */}
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {generatedSegment && (
            <>
              {/* Segment Metadata */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{generatedSegment.segmentName}</CardTitle>
                    {generatedSegment.confidence && (
                      <Badge variant="outline">
                        Confidence: {Math.round(generatedSegment.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{generatedSegment.description}</CardDescription>
                </CardHeader>
                {generatedSegment.reasoning && (
                  <CardContent>
                    <div className="text-sm">
                      <p className="font-medium mb-1">Reasoning:</p>
                      <p className="text-muted-foreground">{generatedSegment.reasoning}</p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* SQL Query */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Generated SQL Query</h3>
                <SQLEditor value={generatedSegment.sqlQuery} readOnly />
              </div>

              {/* Validation Results */}
              {generatedSegment.validation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {generatedSegment.validation.isValid ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          Validation Passed
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          Validation Issues
                        </>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {generatedSegment.validation.errors.length > 0 && (
                      <div>
                        <p className="font-medium text-destructive mb-1">Errors:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {generatedSegment.validation.errors.map((error, idx) => (
                            <li key={idx} className="text-destructive">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {generatedSegment.validation.warnings.length > 0 && (
                      <div>
                        <p className="font-medium text-yellow-600 mb-1">Warnings:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {generatedSegment.validation.warnings.map((warning, idx) => (
                            <li key={idx} className="text-yellow-600">
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {generatedSegment.validation?.isValid && (
                  <Button
                    onClick={handleValidate}
                    disabled={isValidating}
                    variant="secondary"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Validate Audience
                      </>
                    )}
                  </Button>
                )}
                <Button
                  onClick={() => handleSave('draft')}
                  disabled={isSaving}
                  variant="outline"
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
                  disabled={isSaving || !generatedSegment.validation?.isValid}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Approve & Save
                </Button>
              </div>

              {/* Audience Validation Results */}
              {validationResults && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Audience Validated
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Actual Size</p>
                        <p className="text-2xl font-bold">
                          {formatNumber(validationResults.audienceSize)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Query Time</p>
                        <p className="text-2xl font-bold">
                          {(validationResults.executionTime / 1000).toFixed(2)}s
                        </p>
                      </div>
                    </div>

                    {/* Sample Data Table */}
                    {validationResults.sampleData.rows.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Sample Records (first {validationResults.sampleData.rows.length})
                        </h4>
                        <div className="border rounded-lg overflow-auto max-h-96">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                {validationResults.sampleData.columns.map((col) => (
                                  <th key={col.name} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                                    {col.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {validationResults.sampleData.rows.map((row, idx) => (
                                <tr key={idx} className="border-t hover:bg-muted/50">
                                  {validationResults.sampleData.columns.map((col) => (
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

              {validationError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          {!generatedSegment && !error && (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center text-muted-foreground">
                  <p>Generated segment will appear here</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <GeneratePageContent />
    </Suspense>
  );
}
