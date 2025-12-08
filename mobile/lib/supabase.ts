import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helpers
export const signUp = async (email: string, password: string, fullName?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};

// Content queries
export const getContentWithRevenue = async (userId: string, limit = 20, offset = 0) => {
  const { data, error } = await supabase
    .from('content_master')
    .select(`
      *,
      creative_attributes(*),
      revenue_events(commission_amount)
    `)
    .eq('user_id', userId)
    .order('posted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { data: null, error };

  // Calculate EPC for each content
  const contentWithEpc = data?.map((content) => {
    const totalRevenue = content.revenue_events?.reduce(
      (sum: number, event: { commission_amount: number }) => sum + (event.commission_amount || 0),
      0
    ) || 0;
    const epc = content.view_count > 0 ? totalRevenue / content.view_count : 0;

    return {
      ...content,
      total_revenue: totalRevenue,
      epc,
      attributed_orders: content.revenue_events?.length || 0,
    };
  });

  return { data: contentWithEpc, error: null };
};

// Revenue queries
export const getRevenueByPlatform = async (
  userId: string,
  startDate: string,
  endDate: string
) => {
  const { data, error } = await supabase
    .from('revenue_events')
    .select('*')
    .eq('user_id', userId)
    .gte('order_date', startDate)
    .lte('order_date', endDate)
    .order('order_date', { ascending: false });

  return { data, error };
};

export const getDailySummary = async (
  userId: string,
  startDate: string,
  endDate: string
) => {
  const { data, error } = await supabase
    .from('daily_revenue_summary')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  return { data, error };
};

export const getPlatformSummary = async (userId: string) => {
  // Get credentials status
  const { data: credentials } = await supabase
    .from('platform_credentials')
    .select('platform, status, last_sync_at')
    .eq('user_id', userId);

  // Get revenue summary for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: revenue } = await supabase
    .from('revenue_events')
    .select('platform, commission_amount, order_amount')
    .eq('user_id', userId)
    .gte('order_date', thirtyDaysAgo.toISOString());

  // Aggregate by platform
  const platforms: Record<string, {
    total_revenue: number;
    total_orders: number;
    total_order_value: number;
  }> = {};

  revenue?.forEach((event) => {
    if (!platforms[event.platform]) {
      platforms[event.platform] = { total_revenue: 0, total_orders: 0, total_order_value: 0 };
    }
    platforms[event.platform].total_revenue += event.commission_amount || 0;
    platforms[event.platform].total_orders += 1;
    platforms[event.platform].total_order_value += event.order_amount || 0;
  });

  return {
    credentials: credentials || [],
    platformStats: platforms,
  };
};

// Content management
export const addContent = async (
  userId: string,
  url: string,
  source: 'instagram' | 'tiktok' | 'youtube' | 'manual'
) => {
  const { data, error } = await supabase
    .from('content_master')
    .insert({
      user_id: userId,
      url,
      source,
      view_count: 0,
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      save_count: 0,
      is_analyzed: false,
    })
    .select()
    .single();

  return { data, error };
};

// Platform credentials
export const savePlatformCredentials = async (
  userId: string,
  platform: 'amazon' | 'ltk' | 'shopmy' | 'mavely',
  encryptedCookies: string
) => {
  const { data, error } = await supabase
    .from('platform_credentials')
    .upsert({
      user_id: userId,
      platform,
      encrypted_cookies: encryptedCookies,
      status: 'active',
    })
    .select()
    .single();

  return { data, error };
};

export const getPlatformCredentials = async (userId: string) => {
  const { data, error } = await supabase
    .from('platform_credentials')
    .select('*')
    .eq('user_id', userId);

  return { data, error };
};
