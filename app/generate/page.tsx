// app/generate/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GenerateForm } from '@/components/GenerateForm';
import { SQLEditor } from '@/components/SQLEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Save, Eye } from 'lucide-react';

interface GeneratedSegment {
  segmentName: string;
  description: string;
  sqlQuery: string;
  reasoning?: string;
  confidence?: number;
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export default function GeneratePage() {
  const router = useRouter();
  const [generatedSegment, setGeneratedSegment] = useState<GeneratedSegment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message);
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
          targetUseCase: (generatedSegment as any).useCase,
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generate Audience Segment</h1>
        <p className="text-muted-foreground">
          Describe your target audience in natural language and let AI generate the SQL query
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Input Form */}
        <div>
          <GenerateForm onGenerate={handleGenerate} />
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
                      <p className="font-medium mb-1">AI Reasoning:</p>
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
              <div className="flex gap-2">
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
