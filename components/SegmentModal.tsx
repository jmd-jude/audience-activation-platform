'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SQLEditor } from './SQLEditor';
import { formatDateTime, formatNumber, getStatusColor, getUseCaseColor } from '@/lib/utils';
import { Copy, Pencil, X } from 'lucide-react';

interface Segment {
  id: string;
  segmentName: string;
  description: string;
  targetUseCase: string;
  sqlQuery: string;
  status: string;
  estimatedSize?: number | null;
  usageCount: number;
  lastUsed?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
}

interface SegmentModalProps {
  segment: Segment | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onClone?: (id: string) => void;
}

export function SegmentModal({ segment, isOpen, onClose, onEdit, onClone }: SegmentModalProps) {
  if (!segment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-2xl">{segment.segmentName}</DialogTitle>
              <DialogDescription>{segment.description}</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={getStatusColor(segment.status)}>{segment.status}</Badge>
              <Badge variant="outline" className={getUseCaseColor(segment.targetUseCase)}>
                {segment.targetUseCase}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* SQL Query */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">SQL Query</h3>
            <SQLEditor value={segment.sqlQuery} readOnly height="300px" />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Estimated Size</h3>
              <p className="text-lg font-semibold">
                {segment.estimatedSize ? formatNumber(segment.estimatedSize) : 'N/A'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Usage Count</h3>
              <p className="text-lg font-semibold">{segment.usageCount}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
              <p className="text-lg font-semibold">{formatDateTime(segment.createdAt)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Last Updated</h3>
              <p className="text-lg font-semibold">{formatDateTime(segment.updatedAt)}</p>
            </div>
            {segment.approvedBy && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Approved By</h3>
                  <p className="text-lg font-semibold">{segment.approvedBy}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Approved At</h3>
                  <p className="text-lg font-semibold">{formatDateTime(segment.approvedAt)}</p>
                </div>
              </>
            )}
            {segment.lastUsed && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Last Used</h3>
                <p className="text-lg font-semibold">{formatDateTime(segment.lastUsed)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            {onEdit && (
              <Button onClick={() => onEdit(segment.id)} variant="default">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {onClone && (
              <Button onClick={() => onClone(segment.id)} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Clone
              </Button>
            )}
            <Button onClick={onClose} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
