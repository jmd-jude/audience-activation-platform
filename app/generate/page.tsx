// app/generate/page.tsx

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GenerateForm } from '@/components/GenerateForm';
import { SQLEditor } from '@/components/SQLEditor';
import { AudienceCountPanel } from '@/components/AudienceCountPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Save, Sparkles } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, Code2 } from 'lucide-react';

interface GeneratedSegment {
  segmentName: string;
  description: string;
  sqlQuery: string;
  reasoning?: string;
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
  const [isGeneratingSegment, setIsGeneratingSegment] = useState(false);

  // SQL panel visibility — collapsed by default, de-emphasizing the raw query
  const [isSqlOpen, setIsSqlOpen] = useState(false);

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
    setIsGeneratingSegment(true);
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
      setIsSqlOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGeneratingSegment(false);
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
        <h1 className="text-3xl font-bold mb-2">Generate an Audience</h1>
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
                            className="justify-start text-left h-auto whitespace-normal break-words py-3"
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
                  <Button onClick={handleClarificationSubmit} disabled={isGeneratingSegment} className="flex-1">
                    {isGeneratingSegment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate with Clarifications
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkipClarification}
                    disabled={isGeneratingSegment}
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
                  <CardTitle>{generatedSegment.segmentName}</CardTitle>
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
              <Collapsible open={isSqlOpen} onOpenChange={setIsSqlOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isSqlOpen ? 'rotate-180' : ''}`} />
                    <Code2 className="h-4 w-4" />
                    {isSqlOpen ? 'Hide query' : 'View query'}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
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
                </CollapsibleContent>
              </Collapsible>

              {/* Actions */}
              <AudienceCountPanel
                isChecking={isValidating}
                onCheck={() => handleValidate()}
                checkingLabel="Validating..."
                result={validationResults}
                resultError={validationError}
                resultsTitle="Audience Validated"
                adjustInstruction={adjustInstruction}
                onAdjustInstructionChange={setAdjustInstruction}
                onAdjust={handleAdjustQuery}
                isAdjusting={isAdjusting}
                adjustError={adjustError}
                changeSummary={changeSummary}
              />

              {/* Segments are always saved as drafts here — approving or
                  publishing happens on the review page, after a count check
                  has actually run. */}
              <Button
                onClick={() => handleSave('draft')}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save as Draft
              </Button>
            </>
          )}

          {!generatedSegment && !error && !clarificationState && (
            <Card className="border-dashed h-full">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  {isCheckingClarification ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Analyzing your request...</p>
                    </>
                  ) : isGeneratingSegment ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Generating your audience...</p>
                    </>
                  ) : (
                    <p>Audience Workspace</p>
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
