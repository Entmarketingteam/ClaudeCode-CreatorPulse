import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView, MotiPressable } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAuthStore, useContentStore, useRevenueStore } from '../../lib/store';
import { getContentWithRevenue, getPlatformSummary } from '../../lib/supabase';
import {
  formatCurrency,
  formatEPC,
  formatNumber,
  formatRelativeDate,
  getVisualFormatName,
  getPlatformColor,
} from '../../lib/utils';
import { ContentWithRevenue, PlatformType } from '../../types/database';
import SkeletonLoader from '../../components/SkeletonLoader';
import SortFilterBar from '../../components/SortFilterBar';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function Dashboard() {
  const { user } = useAuthStore();
  const { content, setContent, isLoading, setLoading, getSortedContent } =
    useContentStore();
  const { totalRevenue, setTotalRevenue, totalOrders, setTotalOrders } =
    useRevenueStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    const [contentResult, summaryResult] = await Promise.all([
      getContentWithRevenue(user.id),
      getPlatformSummary(user.id),
    ]);

    if (contentResult.data) {
      setContent(contentResult.data);
    }

    if (summaryResult.platformStats) {
      const total = Object.values(summaryResult.platformStats).reduce(
        (sum, p) => sum + p.total_revenue,
        0
      );
      const orders = Object.values(summaryResult.platformStats).reduce(
        (sum, p) => sum + p.total_orders,
        0
      );
      setTotalRevenue(total);
      setTotalOrders(orders);
    }

    setLoading(false);
  }, [user?.id, setContent, setLoading, setTotalRevenue, setTotalOrders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleContentPress = (item: ContentWithRevenue) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/content/${item.id}`);
  };

  const sortedContent = getSortedContent();

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="px-6 pt-16 pb-4">
        <Text className="text-dark-muted text-sm">Welcome back,</Text>
        <Text className="text-white text-2xl font-bold">
          {user?.full_name || 'Creator'}
        </Text>
      </View>

      {/* Revenue Summary */}
      <View className="px-6 mb-4">
        <BlurView intensity={20} className="rounded-2xl overflow-hidden">
          <View className="bg-dark-card/80 p-5 border border-dark-border rounded-2xl">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-dark-muted text-sm mb-1">
                  30-Day Revenue
                </Text>
                <Text className="text-white text-3xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(totalRevenue)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-dark-muted text-sm mb-1">Orders</Text>
                <Text className="text-white text-xl font-semibold">
                  {totalOrders}
                </Text>
              </View>
            </View>

            {/* Platform Pills */}
            <View className="flex-row mt-4 space-x-2">
              {(['amazon', 'ltk', 'shopmy', 'mavely'] as PlatformType[]).map(
                (platform) => (
                  <View
                    key={platform}
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: `${getPlatformColor(platform)}20` }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{ color: getPlatformColor(platform) }}
                    >
                      {platform}
                    </Text>
                  </View>
                )
              )}
            </View>
          </View>
        </BlurView>
      </View>

      {/* Sort/Filter Bar */}
      <SortFilterBar />

      {/* Content Grid */}
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0ea5e9"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <SkeletonLoader count={6} />
        ) : sortedContent.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-dark-muted text-lg mb-2">No content yet</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/content')}
              className="bg-primary-600 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Add Your First Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-between">
            {sortedContent.map((item, index) => (
              <ContentCard
                key={item.id}
                item={item}
                index={index}
                onPress={() => handleContentPress(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Content Card Component
function ContentCard({
  item,
  index,
  onPress,
}: {
  item: ContentWithRevenue;
  index: number;
  onPress: () => void;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay: index * 50 }}
      style={{ width: CARD_WIDTH, marginBottom: 16 }}
    >
      <MotiPressable
        onPress={onPress}
        animate={({ pressed }) => ({
          scale: pressed ? 0.98 : 1,
        })}
        transition={{ type: 'timing', duration: 100 }}
      >
        <View className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border">
          {/* Thumbnail */}
          <View className="aspect-[9/16] relative">
            {item.thumbnail_url ? (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="flex-1 bg-dark-border items-center justify-center">
                <Text className="text-dark-muted">No thumbnail</Text>
              </View>
            )}

            {/* Overlay Metrics */}
            <View className="absolute bottom-0 left-0 right-0">
              <BlurView intensity={40} className="overflow-hidden">
                <View className="bg-black/60 p-3">
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-white/70 text-xs">EPC</Text>
                      <Text className="text-white font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatEPC(item.epc)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-white/70 text-xs">Revenue</Text>
                      <Text className="text-success font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatCurrency(item.total_revenue)}
                      </Text>
                    </View>
                  </View>
                </View>
              </BlurView>
            </View>

            {/* Visual Format Badge */}
            {item.creative_attributes?.visual_format && (
              <View className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-md">
                <Text className="text-white text-xs">
                  {getVisualFormatName(item.creative_attributes.visual_format)}
                </Text>
              </View>
            )}
          </View>

          {/* Card Footer */}
          <View className="p-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-dark-muted text-xs">
                {formatNumber(item.view_count)} views
              </Text>
              <Text className="text-dark-muted text-xs">
                {item.posted_at ? formatRelativeDate(item.posted_at) : ''}
              </Text>
            </View>
          </View>
        </View>
      </MotiPressable>
    </MotiView>
  );
}
