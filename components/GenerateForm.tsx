'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { USE_CASES } from '@/lib/constants';

interface GenerateFormProps {
  onGenerate: (data: {
    naturalLanguageInput: string;
    useCase: string;
    additionalContext?: string;
  }) => Promise<void>;
  initialValues?: {
    naturalLanguageInput?: string;
    useCase?: string;
    additionalContext?: string;
  };
  isRegenerating?: boolean;
}

export function GenerateForm({ onGenerate, initialValues, isRegenerating = false }: GenerateFormProps) {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState(initialValues?.naturalLanguageInput || '');
  const [useCase, setUseCase] = useState(initialValues?.useCase || '');
  const [additionalContext, setAdditionalContext] = useState(initialValues?.additionalContext || '');
  const [isGenerating, setIsGenerating] = useState(false);

  // Update form state when initialValues changes (for discovery handoff)
  // We watch individual properties instead of the whole object to avoid unnecessary re-renders
  useEffect(() => {
    console.log('GenerateForm received initialValues:', initialValues);
    if (initialValues?.naturalLanguageInput) {
      console.log('Setting naturalLanguageInput to:', initialValues.naturalLanguageInput);
      setNaturalLanguageInput(initialValues.naturalLanguageInput);
    }
    if (initialValues?.useCase) {
      console.log('Setting useCase to:', initialValues.useCase);
      setUseCase(initialValues.useCase);
    }
    if (initialValues?.additionalContext) {
      console.log('Setting additionalContext to:', initialValues.additionalContext);
      setAdditionalContext(initialValues.additionalContext);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues?.naturalLanguageInput, initialValues?.useCase, initialValues?.additionalContext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!naturalLanguageInput || !useCase) {
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate({
        naturalLanguageInput,
        useCase,
        additionalContext: additionalContext || undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isRegenerating && <RefreshCw className="h-5 w-5 text-primary" />}
          Describe Your Target Audience in Natural Language
        </CardTitle>
        {isRegenerating && (
          <CardDescription>
            Edit your description below and regenerate to refine the SQL query
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="naturalLanguageInput">
              Audience Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="naturalLanguageInput"
              placeholder={useCase === 'Lookalike Audience'
                ? "Describe your best customers: e.g., Affluent males aged 35-55 in urban areas who travel internationally and have high email engagement"
                : "e.g., Affluent males aged 35-55 in urban areas who are interested in luxury cars and have high-quality email addresses"
              }
              value={naturalLanguageInput}
              onChange={(e) => setNaturalLanguageInput(e.target.value)}
              required
              rows={6}
              className="resize-y"
            />
            {useCase === 'Lookalike Audience' && (
              <p className="text-sm text-muted-foreground">
                Describe demographics, behaviors, and characteristics of your ideal customer profile
              </p>
            )}
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
                {USE_CASES.map((uc) => (
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
              placeholder="Any additional requirements or constraints..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>

          <Button
            type="submit"
            disabled={!naturalLanguageInput || !useCase || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isRegenerating ? 'Regenerating SQL...' : 'Generating Audience...'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {isRegenerating ? 'Regenerate SQL' : 'Generate Audience'}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
