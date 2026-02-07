'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Rocket, AlertCircle } from 'lucide-react';

interface ActivateSegmentDialogProps {
  segmentId: string;
  segmentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PLATFORMS = [
  { value: 'meta', label: 'Meta Ads Manager' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'linkedin', label: 'LinkedIn Campaign Manager' },
  { value: 'mntn', label: 'MNTN - CTV' },
  { value: 'pinterest', label: 'Pinterest Ads' },
];

export function ActivateSegmentDialog({
  segmentId,
  segmentName,
  isOpen,
  onClose,
  onSuccess
}: ActivateSegmentDialogProps) {
  const [platform, setPlatform] = useState('');
  const [externalAudienceId, setExternalAudienceId] = useState('');
  const [audienceSize, setAudienceSize] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform || !externalAudienceId) return;

    setIsActivating(true);
    setError(null);

    try {
      const response = await fetch(`/api/segments/${segmentId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          platformName: PLATFORMS.find(p => p.value === platform)?.label || platform,
          externalAudienceId,
          audienceSize: audienceSize ? parseInt(audienceSize) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to activate segment');
      }

      // Reset form and close
      setPlatform('');
      setExternalAudienceId('');
      setAudienceSize('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsActivating(false);
    }
  };

  const handleClose = () => {
    if (!isActivating) {
      setPlatform('');
      setExternalAudienceId('');
      setAudienceSize('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Activate Segment</DialogTitle>
          <DialogDescription>
            Activate &quot;{segmentName}&quot; on an advertising platform
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="platform">
              Platform <span className="text-destructive">*</span>
            </Label>
            <Select value={platform} onValueChange={setPlatform} required>
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalAudienceId">
              Audience/Campaign ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="externalAudienceId"
              value={externalAudienceId}
              onChange={(e) => setExternalAudienceId(e.target.value)}
              placeholder="e.g., 23856772345678123"
              required
            />
            <p className="text-xs text-muted-foreground">
              The audience or campaign ID from the platform
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audienceSize">Audience Size (Optional)</Label>
            <Input
              id="audienceSize"
              type="number"
              value={audienceSize}
              onChange={(e) => setAudienceSize(e.target.value)}
              placeholder="e.g., 150000"
            />
            <p className="text-xs text-muted-foreground">
              Initial matched audience size on the platform
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isActivating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!platform || !externalAudienceId || isActivating}
            >
              {isActivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
