import { create } from 'zustand';
import { User, ContentWithRevenue, PlatformSummary, PlatformType } from '../types/database';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
}));

interface ContentState {
  content: ContentWithRevenue[];
  isLoading: boolean;
  selectedContent: ContentWithRevenue | null;
  sortBy: 'epc' | 'revenue' | 'views' | 'date';
  filterFormat: string | null;
  setContent: (content: ContentWithRevenue[]) => void;
  addContent: (item: ContentWithRevenue) => void;
  setLoading: (loading: boolean) => void;
  setSelectedContent: (content: ContentWithRevenue | null) => void;
  setSortBy: (sort: 'epc' | 'revenue' | 'views' | 'date') => void;
  setFilterFormat: (format: string | null) => void;
  getSortedContent: () => ContentWithRevenue[];
}

export const useContentStore = create<ContentState>((set, get) => ({
  content: [],
  isLoading: false,
  selectedContent: null,
  sortBy: 'epc',
  filterFormat: null,
  setContent: (content) => set({ content }),
  addContent: (item) => set((state) => ({ content: [item, ...state.content] })),
  setLoading: (isLoading) => set({ isLoading }),
  setSelectedContent: (selectedContent) => set({ selectedContent }),
  setSortBy: (sortBy) => set({ sortBy }),
  setFilterFormat: (filterFormat) => set({ filterFormat }),
  getSortedContent: () => {
    const { content, sortBy, filterFormat } = get();
    let filtered = content;

    if (filterFormat) {
      filtered = content.filter(
        (c) => c.creative_attributes?.visual_format === filterFormat
      );
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'epc':
          return b.epc - a.epc;
        case 'revenue':
          return b.total_revenue - a.total_revenue;
        case 'views':
          return b.view_count - a.view_count;
        case 'date':
          return new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime();
        default:
          return 0;
      }
    });
  },
}));

interface RevenueState {
  platformSummaries: Record<PlatformType, PlatformSummary>;
  totalRevenue: number;
  totalOrders: number;
  isLoading: boolean;
  dateRange: { start: string; end: string };
  setPlatformSummaries: (summaries: Record<PlatformType, PlatformSummary>) => void;
  setTotalRevenue: (total: number) => void;
  setTotalOrders: (total: number) => void;
  setLoading: (loading: boolean) => void;
  setDateRange: (range: { start: string; end: string }) => void;
}

export const useRevenueStore = create<RevenueState>((set) => ({
  platformSummaries: {} as Record<PlatformType, PlatformSummary>,
  totalRevenue: 0,
  totalOrders: 0,
  isLoading: false,
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
  setPlatformSummaries: (platformSummaries) => set({ platformSummaries }),
  setTotalRevenue: (totalRevenue) => set({ totalRevenue }),
  setTotalOrders: (totalOrders) => set({ totalOrders }),
  setLoading: (isLoading) => set({ isLoading }),
  setDateRange: (dateRange) => set({ dateRange }),
}));

interface OnboardingState {
  currentStep: number;
  connectedPlatforms: PlatformType[];
  setStep: (step: number) => void;
  nextStep: () => void;
  addConnectedPlatform: (platform: PlatformType) => void;
  removeConnectedPlatform: (platform: PlatformType) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 0,
  connectedPlatforms: [],
  setStep: (currentStep) => set({ currentStep }),
  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
  addConnectedPlatform: (platform) =>
    set((state) => ({
      connectedPlatforms: [...state.connectedPlatforms, platform],
    })),
  removeConnectedPlatform: (platform) =>
    set((state) => ({
      connectedPlatforms: state.connectedPlatforms.filter((p) => p !== platform),
    })),
}));
