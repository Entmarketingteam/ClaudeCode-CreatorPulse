import { PlatformType } from '../types/database';

// Format currency with tabular numbers
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format EPC (Earnings Per Click/View)
export const formatEPC = (epc: number): string => {
  if (epc === 0) return '$0.00';
  if (epc < 0.01) return `$${(epc * 1000).toFixed(2)}/1K`;
  return `$${epc.toFixed(4)}`;
};

// Format large numbers
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// Format date relative to now
export const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

// Format date for display
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Get platform color
export const getPlatformColor = (platform: PlatformType): string => {
  const colors: Record<PlatformType, string> = {
    amazon: '#FF9900',
    ltk: '#F472B6',
    shopmy: '#8B5CF6',
    mavely: '#10B981',
  };
  return colors[platform];
};

// Get platform display name
export const getPlatformName = (platform: PlatformType): string => {
  const names: Record<PlatformType, string> = {
    amazon: 'Amazon Associates',
    ltk: 'LTK (LikeToKnowIt)',
    shopmy: 'ShopMy',
    mavely: 'Mavely',
  };
  return names[platform];
};

// Get visual format display name
export const getVisualFormatName = (format: string): string => {
  const names: Record<string, string> = {
    talking_head: 'Talking Head',
    voiceover: 'Voiceover',
    product_only: 'Product Only',
    lifestyle: 'Lifestyle',
    tutorial: 'Tutorial',
    unboxing: 'Unboxing',
    haul: 'Haul',
    grwm: 'GRWM',
    review: 'Review',
  };
  return names[format] || format;
};

// Get hook strategy display name
export const getHookStrategyName = (strategy: string): string => {
  const names: Record<string, string> = {
    question: 'Question',
    statement: 'Bold Statement',
    controversy: 'Controversy',
    teaser: 'Teaser',
    direct: 'Direct',
    story: 'Story',
    transformation: 'Transformation',
  };
  return names[strategy] || strategy;
};

// Calculate percentage change
export const calculatePercentageChange = (
  current: number,
  previous: number
): { value: number; isPositive: boolean } => {
  if (previous === 0) return { value: 0, isPositive: true };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(change), isPositive: change >= 0 };
};

// Detect content source from URL
export const detectContentSource = (
  url: string
): 'instagram' | 'tiktok' | 'youtube' | 'manual' => {
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'manual';
};

// Generate skeleton array for loading states
export const generateSkeletonArray = (count: number): number[] => {
  return Array.from({ length: count }, (_, i) => i);
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// Parse hashtags from caption
export const parseHashtags = (caption: string): string[] => {
  const regex = /#[\w]+/g;
  const matches = caption.match(regex);
  return matches ? matches.map((tag) => tag.slice(1)) : [];
};

// Debounce function
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
