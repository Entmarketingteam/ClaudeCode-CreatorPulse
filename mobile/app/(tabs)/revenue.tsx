import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore, useRevenueStore } from '../../lib/store';
import { getDailySummary, getRevenueByPlatform } from '../../lib/supabase';
import {
  formatCurrency,
  formatDate,
  getPlatformColor,
  getPlatformName,
  calculatePercentageChange,
} from '../../lib/utils';
import { PlatformType, RevenueEvent, DailyRevenueSummary } from '../../types/database';

const { width } = Dimensions.get('window');

type DateRangeOption = '7d' | '30d' | '90d' | 'all';

export default function Revenue() {
  const { user } = useAuthStore();
  const { totalRevenue, setTotalRevenue, totalOrders, setTotalOrders, setLoading, isLoading } =
    useRevenueStore();
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [dailyData, setDailyData] = useState<DailyRevenueSummary[]>([]);
  const [revenueEvents, setRevenueEvents] = useState<RevenueEvent[]>([]);
  const [platformBreakdown, setPlatformBreakdown] = useState<
    Record<PlatformType, { revenue: number; orders: number }>
  >({} as Record<PlatformType, { revenue: number; orders: number }>);

  const getDateRange = (range: DateRangeOption) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case 'all':
        start.setFullYear(2020);
        break;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    const { start, end } = getDateRange(dateRange);

    const [dailyResult, eventsResult] = await Promise.all([
      getDailySummary(user.id, start, end),
      getRevenueByPlatform(user.id, start, end),
    ]);

    if (dailyResult.data) {
      setDailyData(dailyResult.data);
    }

    if (eventsResult.data) {
      setRevenueEvents(eventsResult.data);

      // Calculate totals and breakdown
      const breakdown: Record<PlatformType, { revenue: number; orders: number }> = {
        amazon: { revenue: 0, orders: 0 },
        ltk: { revenue: 0, orders: 0 },
        shopmy: { revenue: 0, orders: 0 },
        mavely: { revenue: 0, orders: 0 },
      };

      let total = 0;
      let orders = 0;

      eventsResult.data.forEach((event) => {
        total += event.commission_amount || 0;
        orders += 1;
        if (breakdown[event.platform]) {
          breakdown[event.platform].revenue += event.commission_amount || 0;
          breakdown[event.platform].orders += 1;
        }
      });

      setTotalRevenue(total);
      setTotalOrders(orders);
      setPlatformBreakdown(breakdown);
    }

    setLoading(false);
  }, [user?.id, dateRange, setLoading, setTotalRevenue, setTotalOrders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDateRange(range);
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="px-6 pt-16 pb-4">
        <Text className="text-white text-2xl font-bold">Revenue</Text>
        <Text className="text-dark-muted text-sm">
          Track your earnings across all platforms
        </Text>
      </View>

      {/* Date Range Selector */}
      <View className="px-6 mb-4">
        <View className="flex-row bg-dark-card rounded-xl p-1">
          {(['7d', '30d', '90d', 'all'] as DateRangeOption[]).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => handleDateRangeChange(range)}
              className={`flex-1 py-2 rounded-lg ${
                dateRange === range ? 'bg-primary-600' : ''
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  dateRange === range ? 'text-white' : 'text-dark-muted'
                }`}
              >
                {range === 'all' ? 'All' : range.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1"
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
        {/* Total Revenue Card */}
        <View className="px-6 mb-6">
          <BlurView intensity={20} className="rounded-2xl overflow-hidden">
            <View className="bg-dark-card/80 p-6 border border-dark-border rounded-2xl">
              <Text className="text-dark-muted text-sm mb-1">Total Revenue</Text>
              <Text
                className="text-white text-4xl font-bold mb-4"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCurrency(totalRevenue)}
              </Text>

              <View className="flex-row justify-between">
                <View>
                  <Text className="text-dark-muted text-xs">Orders</Text>
                  <Text className="text-white text-lg font-semibold">
                    {totalOrders}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-dark-muted text-xs">Avg. Order</Text>
                  <Text className="text-white text-lg font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatCurrency(totalOrders > 0 ? totalRevenue / totalOrders : 0)}
                  </Text>
                </View>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Platform Breakdown */}
        <View className="px-6 mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            By Platform
          </Text>
          {(['amazon', 'ltk', 'shopmy', 'mavely'] as PlatformType[]).map(
            (platform, index) => (
              <PlatformCard
                key={platform}
                platform={platform}
                revenue={platformBreakdown[platform]?.revenue || 0}
                orders={platformBreakdown[platform]?.orders || 0}
                totalRevenue={totalRevenue}
                index={index}
              />
            )
          )}
        </View>

        {/* Recent Transactions */}
        <View className="px-6">
          <Text className="text-white text-lg font-semibold mb-3">
            Recent Transactions
          </Text>
          {revenueEvents.slice(0, 10).map((event, index) => (
            <TransactionItem key={event.id} event={event} index={index} />
          ))}

          {revenueEvents.length === 0 && (
            <View className="bg-dark-card border border-dark-border rounded-2xl p-6 items-center">
              <Ionicons name="receipt-outline" size={48} color="#71717A" />
              <Text className="text-dark-muted text-center mt-4">
                No transactions in this period
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function PlatformCard({
  platform,
  revenue,
  orders,
  totalRevenue,
  index,
}: {
  platform: PlatformType;
  revenue: number;
  orders: number;
  totalRevenue: number;
  index: number;
}) {
  const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 300, delay: index * 100 }}
      className="mb-3"
    >
      <View className="bg-dark-card border border-dark-border rounded-xl p-4">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <View
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: getPlatformColor(platform) }}
            />
            <Text className="text-white font-medium">
              {getPlatformName(platform)}
            </Text>
          </View>
          <Text className="text-white font-bold" style={{ fontVariant: ['tabular-nums'] }}>
            {formatCurrency(revenue)}
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-dark-border rounded-full overflow-hidden mb-2">
          <MotiView
            from={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'timing', duration: 500, delay: index * 100 + 200 }}
            style={{
              height: '100%',
              backgroundColor: getPlatformColor(platform),
              borderRadius: 4,
            }}
          />
        </View>

        <View className="flex-row justify-between">
          <Text className="text-dark-muted text-xs">
            {orders} orders
          </Text>
          <Text className="text-dark-muted text-xs">
            {percentage.toFixed(1)}% of total
          </Text>
        </View>
      </View>
    </MotiView>
  );
}

function TransactionItem({
  event,
  index,
}: {
  event: RevenueEvent;
  index: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 200, delay: index * 50 }}
      className="mb-2"
    >
      <View className="bg-dark-card border border-dark-border rounded-xl p-3 flex-row items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${getPlatformColor(event.platform)}20` }}
        >
          <Text style={{ color: getPlatformColor(event.platform), fontWeight: '600' }}>
            {event.platform.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1">
          <Text className="text-white text-sm" numberOfLines={1}>
            {event.product_name || 'Product'}
          </Text>
          <Text className="text-dark-muted text-xs">
            {event.order_date ? formatDate(event.order_date) : 'Unknown date'}
          </Text>
        </View>

        <Text
          className="text-success font-semibold"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          +{formatCurrency(event.commission_amount)}
        </Text>
      </View>
    </MotiView>
  );
}
