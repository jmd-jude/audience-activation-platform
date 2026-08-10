// app/discover/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, ArrowRight, Target, Users, Lightbulb, X } from 'lucide-react';
import { USE_CASES } from '@/lib/constants';
import { DemoPromptDropdown } from '@/components/DemoPromptDropdown';

const MAX_BRIEF_FILE_BYTES = 8 * 1024 * 1024; // 8MB — conservative client-side guardrail
const ACCEPTED_BRIEF_EXTENSIONS = ['.pdf', '.docx'];

interface SemanticSignal {
  field: string;
  meaning: string;
  role: string;
}

interface DiscoveredAudience {
  id: string;
  audienceName: string;
  description: string;
  keyCharacteristics: string[];
  campaignConcept: string;
  targetingCriteria: {
    naturalLanguageInput: string;
    useCase: string;
    additionalContext: string;
  };
  semanticSignals?: SemanticSignal[];
}

export default function DiscoverPage() {
  const router = useRouter();
  const [businessGoal, setBusinessGoal] = useState('');
  const [useCase, setUseCase] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [discoveredAudiences, setDiscoveredAudiences] = useState<DiscoveredAudience[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasBrief = !!briefFile;

  useEffect(() => {
    const cached = sessionStorage.getItem('discover-results');
    if (cached) {
      const { audiences, businessGoal: goal, useCase: uc } = JSON.parse(cached);
      setDiscoveredAudiences(audiences);
      setBusinessGoal(goal);
      setUseCase(uc);
    }
  }, []);

  const toggleSignals = (id: string) => {
    setExpandedSignals(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExampleSelect = (prompt: string) => {
    setBusinessGoal(prompt);
  };

  const clearBrief = () => {
    setBriefFile(null);
    setBriefError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBriefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setBriefError(null);

    if (!selected) {
      setBriefFile(null);
      return;
    }

    const hasValidExtension = ACCEPTED_BRIEF_EXTENSIONS.some((ext) =>
      selected.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExtension) {
      setBriefError('Upload a PDF or Word (.docx) document.');
      setBriefFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (selected.size > MAX_BRIEF_FILE_BYTES) {
      setBriefError('That file is too large — please upload a document under 8MB.');
      setBriefFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setBriefFile(selected);
    setBusinessGoal('');
    setAdditionalContext('');
  };

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!useCase || (!hasBrief && !businessGoal.trim())) {
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('useCase', useCase);
      if (briefFile) {
        formData.append('file', briefFile);
      } else {
        formData.append('businessGoal', businessGoal);
        if (additionalContext) formData.append('additionalContext', additionalContext);
      }

      const response = await fetch('/api/discover-audiences', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to discover audiences');
      }

      const result = await response.json();
      setDiscoveredAudiences(result.audiences);
      sessionStorage.setItem('discover-results', JSON.stringify({
        audiences: result.audiences,
        businessGoal,
        useCase,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    sessionStorage.removeItem('discover-results');
    setDiscoveredAudiences(null);
    setBusinessGoal('');
    setUseCase('');
    clearBrief();
  };

  const handleCreateSegment = (audience: DiscoveredAudience) => {
    // Encode the targeting criteria as URL parameter
    const discoveryData = encodeURIComponent(
      JSON.stringify({
        audienceName: audience.audienceName,
        ...audience.targetingCriteria,
      })
    );

    // Navigate to generate page with pre-populated data
    router.push(`/generate?discovery=${discoveryData}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Lightbulb className="h-8 w-8 text-primary" />
          Discover Audiences
        </h1>
      </div>

      {/* Input Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Describe campaign goals or attach a brief.</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDiscover} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="businessGoal">
                  Campaign Objective <span className="text-destructive">*</span>
                </Label>
                {!hasBrief && <DemoPromptDropdown onSelect={handleExampleSelect} />}
              </div>
              <Textarea
                id="businessGoal"
                placeholder={useCase === 'Lookalike Audience'
                  ? "Describe your best customers: e.g., High-income professionals aged 40-55 who travel frequently, own luxury vehicles, and have premium credit cards"
                  : "e.g., Increase premium product sales, reach eco-conscious consumers, drive holiday shopping engagement..."
                }
                value={businessGoal}
                onChange={(e) => setBusinessGoal(e.target.value)}
                disabled={hasBrief}
                required={!hasBrief}
                rows={3}
                className="resize-none"
              />
              {(hasBrief || useCase === 'Lookalike Audience') && (
                <p className="text-sm text-muted-foreground">
                  {hasBrief
                    ? "Business goal will be read from your attached brief."
                    : "Be specific about demographics, behaviors, and purchase patterns of your ideal customers"
                  }
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Label htmlFor="briefFile" className="text-muted-foreground whitespace-nowrap">
                Or attach a brief instead:
              </Label>
              <input
                ref={fileInputRef}
                id="briefFile"
                type="file"
                accept=".pdf,.docx"
                onChange={handleBriefFileChange}
                title="PDF or Word (.docx), up to 8MB"
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:cursor-pointer"
              />
              {hasBrief && (
                <Button type="button" variant="ghost" size="sm" onClick={clearBrief} className="h-auto py-0.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            {briefError && (
              <Alert variant="destructive">
                <AlertDescription>{briefError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="useCase">
                Use Case <span className="text-destructive">*</span>
              </Label>
              <Select value={useCase} onValueChange={setUseCase} required>
                <SelectTrigger id="useCase">
                  <SelectValue placeholder="Select a use case" />
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

            {!hasBrief && (
              <div className="space-y-2">
                <Label htmlFor="additionalContext">Additional Context (Optional)</Label>
                <Textarea
                  id="additionalContext"
                  placeholder="Any specific requirements, constraints, or preferences..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={!useCase || (!hasBrief && !businessGoal.trim()) || isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Discovering Audiences...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Discover Audiences
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Section */}
      {discoveredAudiences && discoveredAudiences.length > 0 && (
        <div>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Users className="h-6 w-6" />
                Discovered Audiences
              </h2>
              <p className="text-muted-foreground">
                {discoveredAudiences.length} strategic audience segments to help achieve your goal
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {discoveredAudiences.map((audience) => (
              <Card key={audience.id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2">
                    <span className="text-lg">{audience.audienceName}</span>
                    <Target className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {audience.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-4 flex-1">
                    {/* Key Characteristics */}
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Key Characteristics:</h4>
                      <ul className="space-y-1">
                        {audience.keyCharacteristics.map((char, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span className="text-muted-foreground">{char}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Campaign Concepts */}
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Campaign Concepts:</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {audience.campaignConcept}
                      </p>
                    </div>
                  </div>

                  {/* Semantic Intelligence Reveal */}
                  {audience.semanticSignals && audience.semanticSignals.length > 0 && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => toggleSignals(audience.id)}
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.7rem',
                          color: expandedSignals.has(audience.id) ? 'var(--orange, #7c8d44)' : 'var(--gray-400, #9ca3af)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          cursor: 'pointer',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--orange, #7c8d44)')}
                        onMouseLeave={e => (e.currentTarget.style.color = expandedSignals.has(audience.id) ? 'var(--orange, #7c8d44)' : 'var(--gray-400, #9ca3af)')}
                      >
                        Why this audience? {expandedSignals.has(audience.id) ? '▴' : '▾'}
                      </button>

                      <div
                        style={{
                          maxHeight: expandedSignals.has(audience.id) ? '600px' : '0',
                          overflow: 'hidden',
                          transition: 'max-height 0.25s ease',
                        }}
                      >
                        <div
                          style={{
                            marginTop: '0.5rem',
                            background: 'var(--cream-dark, #ecf0ea)',
                            border: '1px solid var(--cream-dark, #ecf0ea)',
                            borderRadius: '4px',
                            padding: '1rem',
                            maxHeight: '360px',
                            overflowY: 'auto',
                          }}
                        >
                          {audience.semanticSignals.map((signal, idx) => (
                            <div
                              key={idx}
                              style={{
                                paddingBottom: idx < audience.semanticSignals!.length - 1 ? '0.75rem' : 0,
                                marginBottom: idx < audience.semanticSignals!.length - 1 ? '0.75rem' : 0,
                                borderBottom: idx < audience.semanticSignals!.length - 1 ? '1px solid var(--cream-dark, #dce2da)' : 'none',
                              }}
                            >
                              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--black, #1e2a33)', marginBottom: '0.25rem' }}>
                                {signal.field}
                              </div>
                              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: 'var(--gray-600, #5e6d78)', marginBottom: '0.2rem' }}>
                                {signal.meaning}
                              </div>
                              <div style={{ fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--orange, #7c8d44)' }}>
                                {signal.role}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <Button
                    onClick={() => handleCreateSegment(audience)}
                    className="w-full mt-4"
                    variant="default"
                  >
                    Create this segment
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isGenerating && !discoveredAudiences && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Audience recommendations will appear here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
