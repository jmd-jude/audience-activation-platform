'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles } from 'lucide-react';

interface GenerateFormProps {
  onGenerate: (data: {
    naturalLanguageInput: string;
    useCase: string;
    additionalContext?: string;
  }) => Promise<void>;
}

const useCases = [
  'Marketing',
  'Sales',
  'Analytics',
  'Customer Acquisition',
  'Retention',
];

export function GenerateForm({ onGenerate }: GenerateFormProps) {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [useCase, setUseCase] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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
        <CardTitle>Describe Your Audience</CardTitle>
        <CardDescription>
          Describe your target audience in natural language, and AI will generate the SQL query
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="naturalLanguageInput">
              Audience Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="naturalLanguageInput"
              placeholder="e.g., Affluent males aged 35-55 in urban areas who are interested in luxury cars and have high-quality email addresses"
              value={naturalLanguageInput}
              onChange={(e) => setNaturalLanguageInput(e.target.value)}
              required
              rows={4}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              Be specific about demographics, behaviors, and contact requirements
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
              placeholder="Any additional requirements or constraints..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={2}
              className="resize-none"
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
                Generating Segment...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Segment
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
