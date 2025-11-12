'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatNumber, getStatusColor, getUseCaseColor, truncate } from '@/lib/utils';
import { Eye, Copy, Pencil, Trash2 } from 'lucide-react';

interface Segment {
  id: string;
  segmentName: string;
  description: string;
  targetUseCase: string;
  status: string;
  estimatedSize?: number | null;
  usageCount: number;
  lastUsed?: Date | string | null;
  createdAt: Date | string;
}

interface SegmentCardProps {
  segment: Segment;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onClone?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function SegmentCard({ segment, onView, onEdit, onClone, onDelete }: SegmentCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{segment.segmentName}</CardTitle>
          <Badge className={getStatusColor(segment.status)}>{segment.status}</Badge>
        </div>
        <CardDescription>{truncate(segment.description, 120)}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getUseCaseColor(segment.targetUseCase)}>
              {segment.targetUseCase}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Estimated Size:</span>{' '}
              {segment.estimatedSize ? formatNumber(segment.estimatedSize) : 'N/A'}
            </div>
            <div>
              <span className="font-medium">Usage Count:</span> {segment.usageCount}
            </div>
            <div>
              <span className="font-medium">Created:</span> {formatDate(segment.createdAt)}
            </div>
            <div>
              <span className="font-medium">Last Used:</span> {formatDate(segment.lastUsed)}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {onView && (
          <Button variant="default" size="sm" onClick={() => onView(segment.id)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(segment.id)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
        {onClone && (
          <Button variant="outline" size="sm" onClick={() => onClone(segment.id)}>
            <Copy className="h-4 w-4 mr-1" />
            Clone
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" size="sm" onClick={() => onDelete(segment.id)}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
