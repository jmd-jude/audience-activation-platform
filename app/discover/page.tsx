// app/discover/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, ArrowRight, Target, Users, Lightbulb } from 'lucide-react';

interface DiscoveredAudience {
  id: string;
  audienceName: string;
  description: string;
  keyCharacteristics: string[];
  marketingOpportunity: string;
  targetingCriteria: {
    naturalLanguageInput: string;
    useCase: string;
    additionalContext: string;
  };
}

const useCases = [
  'Marketing',
  'Sales',
  'Analytics',
  'Customer Acquisition',
  'Retention',
  'Lookalike Audience',
];

export default function DiscoverPage() {
  const router = useRouter();
  const [businessGoal, setBusinessGoal] = useState('');
  const [useCase, setUseCase] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [discoveredAudiences, setDiscoveredAudiences] = useState<DiscoveredAudience[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessGoal || !useCase) {
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/discover-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessGoal,
          useCase,
          additionalContext: additionalContext || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to discover audiences');
      }

      const result = await response.json();
      setDiscoveredAudiences(result.audiences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
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
        <p className="text-muted-foreground">
          Describe your business goal to discover audience segments.
        </p>
      </div>

      {/* Input Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What&apos;s Your Business Goal?</CardTitle>
          <CardDescription>
            Describe what you want to achieve. We suggest creative audience segments to help you get there
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDiscover} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessGoal">
                Business Goal <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="businessGoal"
                placeholder={useCase === 'Lookalike Audience'
                  ? "Describe your best customers: e.g., High-income professionals aged 40-55 who travel frequently, own luxury vehicles, and have premium credit cards"
                  : "e.g., Increase premium product sales, reach eco-conscious consumers, drive holiday shopping engagement..."
                }
                value={businessGoal}
                onChange={(e) => setBusinessGoal(e.target.value)}
                required
                rows={3}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                {useCase === 'Lookalike Audience'
                  ? "Be specific about demographics, behaviors, and purchase patterns of your ideal customers"
                  : "Focus on outcomes and objectives rather than technical requirements"
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="useCase">
                Use Case <span className="text-destructive">*</span>
              </Label>
              <Select value={useCase} onValueChange={setUseCase} required>
                <SelectTrigger id="useCase">
                  <SelectValue placeholder="Select a use case" />
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

            <Button
              type="submit"
              disabled={!businessGoal || !useCase || isGenerating}
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Users className="h-6 w-6" />
              Discovered Audiences
            </h2>
            <p className="text-muted-foreground">
              {discoveredAudiences.length} strategic audience segments to help achieve your goal
            </p>
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

                    {/* Marketing Opportunity */}
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Marketing Opportunity:</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {audience.marketingOpportunity}
                      </p>
                    </div>
                  </div>

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
              Discovered audiences will appear here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
