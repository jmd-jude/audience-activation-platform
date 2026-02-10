/**
 * Platform and Use Case Constants
 *
 * This is the SINGLE SOURCE OF TRUTH for platforms and use cases.
 * Edit these lists to add/remove/modify options across the entire application.
 */

export interface Platform {
  value: string;
  label: string;
}

export const PLATFORMS: Platform[] = [
  { value: 'meta', label: 'Meta Ads Manager' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'linkedin', label: 'LinkedIn Campaign Manager' },
  { value: 'mntn', label: 'MNTN - CTV' },
  { value: 'pinterest', label: 'Pinterest Ads' },
];

export const USE_CASES: string[] = [
  'Awareness',
  'Customer Acquisition',
  'Retention',
  'Lookalike Audience',
];

export const SEGMENT_STATUSES = ['draft', 'approved', 'published'] as const;
export type SegmentStatus = typeof SEGMENT_STATUSES[number];
