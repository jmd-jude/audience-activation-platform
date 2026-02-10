// app/library/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentCard } from '@/components/SegmentCard';
import { SegmentModal } from '@/components/SegmentModal';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import { SEGMENT_STATUSES } from '@/lib/constants';

interface SegmentMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  roas: number | null;
  ctr: number | null;
  activeActivations: number;
  totalActivations: number;
}

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
  metrics?: SegmentMetrics | null;
}

export default function LibraryPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [filteredSegments, setFilteredSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [useCaseFilter, setUseCaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');

  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dynamic use cases from API
  const [useCases, setUseCases] = useState<string[]>(['all']);

  // Fetch use cases from API
  useEffect(() => {
    const fetchUseCases = async () => {
      try {
        const response = await fetch('/api/enums/use-cases');
        if (response.ok) {
          const data = await response.json();
          setUseCases(['all', ...data]);
        }
      } catch (error) {
        console.error('Error fetching use cases:', error);
      }
    };

    fetchUseCases();
  }, []);

  // Fetch segments
  useEffect(() => {
    fetchSegments();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...segments];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (seg) =>
          seg.segmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          seg.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Use case filter
    if (useCaseFilter !== 'all') {
      filtered = filtered.filter((seg) => seg.targetUseCase === useCaseFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((seg) => seg.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
      } else if (sortBy === 'segmentName') {
        return a.segmentName.localeCompare(b.segmentName);
      } else if (sortBy === 'usageCount') {
        return b.usageCount - a.usageCount;
      }
      return 0;
    });

    setFilteredSegments(filtered);
  }, [segments, searchQuery, useCaseFilter, statusFilter, sortBy]);

  const fetchSegments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/segments');
      if (!response.ok) throw new Error('Failed to fetch segments');
      const data = await response.json();
      setSegments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (id: string) => {
    const segment = segments.find((s) => s.id === id);
    if (segment) {
      setSelectedSegment(segment);
      setIsModalOpen(true);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/review/${id}`);
  };

  const handleClone = async (id: string) => {
    try {
      const response = await fetch(`/api/segments/${id}/clone`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to clone segment');
      const clonedSegment = await response.json();
      router.push(`/review/${clonedSegment.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;

    try {
      const response = await fetch(`/api/segments/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete segment');

      // Refresh segments
      await fetchSegments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const statuses = ['all', ...SEGMENT_STATUSES];
  const sortOptions = [
    { value: 'createdAt', label: 'Newest' },
    { value: 'updatedAt', label: 'Recently Updated' },
    { value: 'usageCount', label: 'Most Used' },
    { value: 'segmentName', label: 'Alphabetical' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Segment Library</h1>
        <p className="text-muted-foreground">
          Browse, search, and manage your audience segments
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search segments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={useCaseFilter} onValueChange={setUseCaseFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Use Case" />
          </SelectTrigger>
          <SelectContent>
            {useCases.map((uc) => (
              <SelectItem key={uc} value={uc}>
                {uc === 'all' ? 'All Use Cases' : uc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {filteredSegments.length} of {segments.length} segments
      </div>

      {/* Segments Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No segments found</p>
          <Button
            onClick={() => router.push('/generate')}
            className="mt-4"
          >
            Build New Segment
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSegments.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              onView={handleView}
              onEdit={handleEdit}
              onClone={handleClone}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Segment Detail Modal */}
      <SegmentModal
        segment={selectedSegment}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSegment(null);
        }}
        onEdit={handleEdit}
        onClone={handleClone}
      />
    </div>
  );
}
