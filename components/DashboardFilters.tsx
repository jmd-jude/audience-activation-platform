'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardFiltersProps {
  selectedUseCase: string;
  selectedPlatform: string;
  onUseCaseChange: (value: string) => void;
  onPlatformChange: (value: string) => void;
}

interface Platform {
  value: string;
  label: string;
}

export function DashboardFilters({
  selectedUseCase,
  selectedPlatform,
  onUseCaseChange,
  onPlatformChange,
}: DashboardFiltersProps) {
  const [useCases, setUseCases] = useState<string[]>(['All']);
  const [platforms, setPlatforms] = useState<Platform[]>([{ value: 'all', label: 'All' }]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEnums = async () => {
      try {
        // Fetch use cases
        const useCasesResponse = await fetch('/api/enums/use-cases');
        if (useCasesResponse.ok) {
          const useCasesData = await useCasesResponse.json();
          setUseCases(['All', ...useCasesData]);
        }

        // Fetch platforms
        const platformsResponse = await fetch('/api/enums/platforms');
        if (platformsResponse.ok) {
          const platformsData = await platformsResponse.json();
          setPlatforms([{ value: 'all', label: 'All' }, ...platformsData]);
        }
      } catch (error) {
        console.error('Error fetching filter options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnums();
  }, []);

  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex items-center gap-2">
        <label htmlFor="useCase" className="text-sm font-medium whitespace-nowrap">
          Use Case:
        </label>
        <Select value={selectedUseCase} onValueChange={onUseCaseChange} disabled={isLoading}>
          <SelectTrigger id="useCase" className="w-[180px]">
            <SelectValue placeholder={isLoading ? "Loading..." : "Select use case"} />
          </SelectTrigger>
          <SelectContent>
            {useCases.map((useCase) => (
              <SelectItem key={useCase} value={useCase}>
                {useCase}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="platform" className="text-sm font-medium whitespace-nowrap">
          Platform:
        </label>
        <Select value={selectedPlatform} onValueChange={onPlatformChange} disabled={isLoading}>
          <SelectTrigger id="platform" className="w-[180px]">
            <SelectValue placeholder={isLoading ? "Loading..." : "Select platform"} />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((platform) => (
              <SelectItem key={platform.value} value={platform.value}>
                {platform.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
