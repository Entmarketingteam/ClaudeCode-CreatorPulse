import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAuthStore, useContentStore } from '../../lib/store';
import { addContent, getContentWithRevenue } from '../../lib/supabase';
import { detectContentSource, formatRelativeDate, formatNumber } from '../../lib/utils';
import { ContentWithRevenue } from '../../types/database';

export default function Content() {
  const { user } = useAuthStore();
  const { content, setContent, addContent: addToStore, setLoading, isLoading } =
    useContentStore();
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadContent = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await getContentWithRevenue(user.id);
    if (data) setContent(data);
    setLoading(false);
  }, [user?.id, setContent, setLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadContent();
    setRefreshing(false);
  }, [loadContent]);

  const handleAddContent = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!user?.id) return;

    setIsAdding(true);
    setError('');

    const source = detectContentSource(url);
    const { data, error: addError } = await addContent(user.id, url, source);

    if (addError) {
      setError(addError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (data) {
      addToStore({
        ...data,
        creative_attributes: null,
        total_revenue: 0,
        epc: 0,
        attributed_orders: 0,
      });
      setUrl('');
      setShowAddForm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsAdding(false);
  };

  const handleContentPress = (item: ContentWithRevenue) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/content/${item.id}`);
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="px-6 pt-16 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-white text-2xl font-bold">Content</Text>
          <Text className="text-dark-muted text-sm">
            {content.length} posts tracked
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setShowAddForm(!showAddForm);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className="bg-primary-600 w-10 h-10 rounded-full items-center justify-center"
        >
          <Ionicons
            name={showAddForm ? 'close' : 'add'}
            size={24}
            color="white"
          />
        </TouchableOpacity>
      </View>

      {/* Add Content Form */}
      {showAddForm && (
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -20 }}
          className="px-6 mb-4"
        >
          <View className="bg-dark-card border border-dark-border rounded-2xl p-4">
            <Text className="text-white font-semibold mb-3">Add Content</Text>

            {error ? (
              <Text className="text-error text-sm mb-3">{error}</Text>
            ) : null}

            <TextInput
              className="bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white mb-3"
              placeholder="Paste Instagram or TikTok URL"
              placeholderTextColor="#71717A"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowAddForm(false)}
                className="flex-1 bg-dark-border py-3 rounded-xl"
              >
                <Text className="text-white text-center font-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddContent}
                disabled={isAdding}
                className={`flex-1 py-3 rounded-xl ${
                  isAdding ? 'bg-primary-600/50' : 'bg-primary-600'
                }`}
              >
                {isAdding ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white text-center font-medium">
                    Add
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </MotiView>
      )}

      {/* Content List */}
      <ScrollView
        className="flex-1 px-6"
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
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#0ea5e9" />
          </View>
        ) : content.length === 0 ? (
          <View className="py-20 items-center">
            <Ionicons name="images-outline" size={48} color="#71717A" />
            <Text className="text-dark-muted text-lg mt-4 mb-2">
              No content yet
            </Text>
            <Text className="text-dark-muted text-sm text-center mb-6">
              Add your Instagram Reels or TikToks to start tracking performance
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddForm(true)}
              className="bg-primary-600 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Add Your First Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          content.map((item, index) => (
            <ContentListItem
              key={item.id}
              item={item}
              index={index}
              onPress={() => handleContentPress(item)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ContentListItem({
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
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 300, delay: index * 50 }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-row bg-dark-card border border-dark-border rounded-2xl p-3 mb-3"
      >
        {/* Thumbnail */}
        <View className="w-16 h-24 rounded-xl overflow-hidden bg-dark-border">
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={24} color="#71717A" />
            </View>
          )}
        </View>

        {/* Details */}
        <View className="flex-1 ml-3 justify-between">
          <View>
            <View className="flex-row items-center mb-1">
              <View
                className={`w-2 h-2 rounded-full mr-2 ${
                  item.is_analyzed ? 'bg-success' : 'bg-warning'
                }`}
              />
              <Text className="text-dark-muted text-xs">
                {item.is_analyzed ? 'Analyzed' : 'Pending analysis'}
              </Text>
            </View>
            <Text
              className="text-white text-sm"
              numberOfLines={2}
            >
              {item.caption || 'No caption'}
            </Text>
          </View>

          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-dark-muted text-xs">Views</Text>
              <Text className="text-white font-semibold">
                {formatNumber(item.view_count)}
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-dark-muted text-xs">Revenue</Text>
              <Text className="text-success font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                ${item.total_revenue.toFixed(2)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-dark-muted text-xs">Posted</Text>
              <Text className="text-white text-sm">
                {item.posted_at ? formatRelativeDate(item.posted_at) : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>

        {/* Arrow */}
        <View className="justify-center ml-2">
          <Ionicons name="chevron-forward" size={20} color="#71717A" />
        </View>
      </TouchableOpacity>
    </MotiView>
  );
}
