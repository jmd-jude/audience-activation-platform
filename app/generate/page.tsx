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
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertCircle, Save, Sparkles, Database, Wand2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { SEGMENT_STATUSES } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface GeneratedSegment {
  segmentName: string;
  description: string;
  sqlQuery: string;
  reasoning?: string;
  confidence?: number;
  useCase?: string;
}

interface ClarificationQuestion {
  id: string;
  question: string;
  options?: string[];
  rationale?: string;
}

interface ClarificationState {
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  additionalContext?: string;
  originalInput: {
    naturalLanguageInput: string;
    useCase: string;
    additionalContext?: string;
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

  // Clarification state
  const [clarificationState, setClarificationState] = useState<ClarificationState | null>(null);
  const [isCheckingClarification, setIsCheckingClarification] = useState(false);

  // Status selection
  const [selectedStatus, setSelectedStatus] = useState<'draft' | 'approved' | 'published'>('draft');

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

  // Adjust-audience state
  const [adjustInstruction, setAdjustInstruction] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState<string | null>(null);

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
    setValidationResults(null); // Clear previous validation results when regenerating
    setValidationError(null);
    setClarificationState(null); // Clear any previous clarification state

    // Step 1: Check if clarification is needed
    setIsCheckingClarification(true);
    try {
      const clarifyResponse = await fetch('/api/clarify-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (clarifyResponse.ok) {
        const clarifyResult = await clarifyResponse.json();

        if (clarifyResult.needsClarification && clarifyResult.questions?.length > 0) {
          // Show clarification questions
          setClarificationState({
            questions: clarifyResult.questions,
            answers: {},
            originalInput: data,
          });
          setIsCheckingClarification(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Clarification check failed, proceeding with generation:', err);
      // Continue to generation even if clarification check fails
    }
    setIsCheckingClarification(false);

    // Step 2: Generate segment (either directly or if clarification was skipped)
    await generateSegment(data);
  };

  const generateSegment = async (
    data: {
      naturalLanguageInput: string;
      useCase: string;
      additionalContext?: string;
    },
    clarificationQA?: Array<{ question: string; answer: string }>
  ) => {
    try {
      const response = await fetch('/api/generate-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          clarificationQA,
        }),
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

  const handleClarificationSubmit = async () => {
    if (!clarificationState) return;

    // Build clarification Q&A array
    const clarificationQA = clarificationState.questions.map(q => ({
      question: q.question,
      answer: clarificationState.answers[q.id] || 'No specific preference',
    }));

    // Add additional context as a clarification if provided
    if (clarificationState.additionalContext?.trim()) {
      clarificationQA.push({
        question: 'Additional context provided',
        answer: clarificationState.additionalContext.trim(),
      });
    }

    // Clear clarification state and generate
    setClarificationState(null);
    await generateSegment(clarificationState.originalInput, clarificationQA);
  };

  const handleSkipClarification = async () => {
    if (!clarificationState) return;

    // Clear clarification state and generate without answers
    const originalInput = clarificationState.originalInput;
    setClarificationState(null);
    await generateSegment(originalInput);
  };

  const handleValidate = async (queryOverride?: string) => {
    const queryToCheck = queryOverride ?? generatedSegment?.sqlQuery;
    if (!queryToCheck) return;

    setIsValidating(true);
    setValidationError(null);
    setValidationResults(null);

    try {
      const response = await fetch('/api/snowflake/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sqlQuery: queryToCheck
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

  const handleAdjustQuery = async () => {
    if (!generatedSegment?.sqlQuery || !adjustInstruction.trim()) return;

    setIsAdjusting(true);
    setAdjustError(null);
    setChangeSummary(null);
    setValidationResults(null);
    setValidationError(null);

    try {
      const response = await fetch('/api/adjust-segment-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sqlQuery: generatedSegment.sqlQuery,
          currentCount: validationResults?.audienceSize ?? null,
          description: generatedSegment.description,
          useCase: generatedSegment.useCase,
          instruction: adjustInstruction.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to adjust query');
      }

      const data = await response.json();
      setGeneratedSegment(prev => prev ? { ...prev, sqlQuery: data.sqlQuery } : null);
      setChangeSummary(data.changeSummary);
      setAdjustInstruction('');

      // Immediately re-check the count against the revised query
      await handleValidate(data.sqlQuery);
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleSave = async (status: 'draft' | 'approved' | 'published') => {
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
          estimatedSize: validationResults?.audienceSize || null,
          reasoning: generatedSegment.reasoning || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save segment');
      }

      const savedSegment = await response.json();

      // Always go to review page for drafts, library for approved/published
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
            isRegenerating={!!generatedSegment}
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

          {/* Clarification Questions */}
          {clarificationState && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Quick Questions
                </CardTitle>
                <CardDescription>
                  Help us refine your audience by answering a few additional questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {clarificationState.questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <label className="text-sm font-medium">
                      {q.question}
                    </label>
                    {q.rationale && (
                      <p className="text-xs text-muted-foreground">{q.rationale}</p>
                    )}
                    {q.options && q.options.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((option) => (
                          <Button
                            key={option}
                            variant={
                              clarificationState.answers[q.id] === option
                                ? 'default'
                                : 'outline'
                            }
                            onClick={() => {
                              setClarificationState({
                                ...clarificationState,
                                answers: {
                                  ...clarificationState.answers,
                                  [q.id]: option,
                                },
                              });
                            }}
                            className="justify-start text-left h-auto whitespace-normal py-3"
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                        placeholder="Your answer..."
                        value={clarificationState.answers[q.id] || ''}
                        onChange={(e) => {
                          setClarificationState({
                            ...clarificationState,
                            answers: {
                              ...clarificationState.answers,
                              [q.id]: e.target.value,
                            },
                          });
                        }}
                      />
                    )}
                  </div>
                ))}

                {/* Optional additional context */}
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-sm font-medium text-muted-foreground">
                    Additional context (optional)
                  </label>
                  <textarea
                    className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Any other details that might help refine the audience..."
                    value={clarificationState.additionalContext || ''}
                    onChange={(e) => {
                      setClarificationState({
                        ...clarificationState,
                        additionalContext: e.target.value,
                      });
                    }}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleClarificationSubmit} className="flex-1">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate with Clarifications
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkipClarification}
                  >
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                <SQLEditor
                  value={generatedSegment.sqlQuery}
                  onChange={(newSql) => {
                    if (newSql !== undefined) {
                      setGeneratedSegment(prev => prev ? { ...prev, sqlQuery: newSql } : null);
                      // Clear stale validation/adjust results when SQL is edited
                      if (validationResults) {
                        setValidationResults(null);
                      }
                      if (changeSummary) {
                        setChangeSummary(null);
                      }
                    }
                  }}
                />
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <Button
                  onClick={() => handleValidate()}
                  disabled={isValidating}
                  variant="secondary"
                  className="w-full"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
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
                      onChange={(e) => setAdjustInstruction(e.target.value)}
                      placeholder="e.g. grow this a bit but keep it focused on high-income households"
                      disabled={isAdjusting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isAdjusting && adjustInstruction.trim()) {
                          e.preventDefault();
                          handleAdjustQuery();
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      onClick={handleAdjustQuery}
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
                    Describe how you'd like the audience to change — the query updates and re-checks the count automatically.
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

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                    <SelectTrigger id="status">
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
                  onClick={() => handleSave(selectedStatus)}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Segment
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

          {!generatedSegment && !error && !clarificationState && (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center text-muted-foreground">
                  {isCheckingClarification ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Analyzing your request...</p>
                    </>
                  ) : (
                    <p>Generated segment will appear here</p>
                  )}
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
