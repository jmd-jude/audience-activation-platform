import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS classes
 * Combines clsx and tailwind-merge for proper class handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date to a readable string
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a number with commas
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('en-US');
}

/**
 * Truncates text to a specified length
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Generates a status badge color based on segment status
 */
export function getStatusColor(status: string): string {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    approved: 'bg-green-100 text-green-800',
    active: 'bg-blue-100 text-blue-800',
  };
  return colors[status as keyof typeof colors] || colors.draft;
}

/**
 * Generates a use case badge color
 */
export function getUseCaseColor(useCase: string): string {
  const colors = {
    Marketing: 'bg-purple-100 text-purple-800',
    Sales: 'bg-blue-100 text-blue-800',
    Analytics: 'bg-teal-100 text-teal-800',
    'Customer Acquisition': 'bg-orange-100 text-orange-800',
    Retention: 'bg-pink-100 text-pink-800',
  };
  return colors[useCase as keyof typeof colors] || 'bg-gray-100 text-gray-800';
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Sleep utility for adding delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Formats currency values
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats percentage values
 */
export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats decimal values (for ROAS)
 */
export function formatDecimal(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return 'N/A';
  return value.toFixed(decimals);
}

/**
 * Calculates derived metrics
 */
export function calculateMetrics(data: {
  impressions?: number | null;
  clicks?: number | null;
  conversions?: number | null;
  spend?: number | null;
  revenue?: number | null;
}) {
  return {
    ctr: data.clicks && data.impressions ? (data.clicks / data.impressions) * 100 : null,
    cpa: data.spend && data.conversions ? data.spend / data.conversions : null,
    roas: data.revenue && data.spend ? data.revenue / data.spend : null,
    conversionRate: data.conversions && data.clicks ? (data.conversions / data.clicks) * 100 : null,
  };
}

/**
 * Gets platform badge color
 */
export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    meta: 'bg-blue-100 text-blue-800',
    google: 'bg-red-100 text-red-800',
    tiktok: 'bg-pink-100 text-pink-800',
    linkedin: 'bg-cyan-100 text-cyan-800',
    mntn: 'bg-purple-100 text-purple-800',
    pinterest: 'bg-rose-100 text-rose-800',
  };
  return colors[platform.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

/**
 * Gets activation status color
 */
export function getActivationStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
