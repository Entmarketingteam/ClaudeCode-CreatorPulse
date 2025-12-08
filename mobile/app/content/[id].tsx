import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import {
  formatCurrency,
  formatEPC,
  formatNumber,
  formatDate,
  getVisualFormatName,
  getHookStrategyName,
  getPlatformColor,
} from '../../lib/utils';
import { ContentMaster, CreativeAttributes, RevenueEvent } from '../../types/database';

export default function ContentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState<ContentMaster | null>(null);
  const [attributes, setAttributes] = useState<CreativeAttributes | null>(null);
  const [revenue, setRevenue] = useState<RevenueEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, [id]);

  const loadContent = async () => {
    if (!id) return;

    setIsLoading(true);

    // Fetch content and related data
    const [contentResult, attributesResult, revenueResult] = await Promise.all([
      supabase.from('content_master').select('*').eq('id', id).single(),
      supabase.from('creative_attributes').select('*').eq('content_id', id).single(),
      supabase.from('revenue_events').select('*').eq('attributed_content_id', id),
    ]);

    if (contentResult.data) setContent(contentResult.data);
    if (attributesResult.data) setAttributes(attributesResult.data);
    if (revenueResult.data) setRevenue(revenueResult.data);

    setIsLoading(false);
  };

  const totalRevenue = revenue.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const epc = content && content.view_count > 0 ? totalRevenue / content.view_count : 0;

  if (isLoading) {
    return (
      <View className="flex-1 bg-dark-bg items-center justify-center">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!content) {
    return (
      <View className="flex-1 bg-dark-bg items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#71717A" />
        <Text className="text-white text-lg mt-4">Content not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="absolute top-0 left-0 right-0 z-10 pt-14 px-4">
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Thumbnail */}
        <View className="aspect-[9/16] w-full">
          {content.thumbnail_url ? (
            <Image
              source={{ uri: content.thumbnail_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 bg-dark-card items-center justify-center">
              <Ionicons name="image-outline" size={64} color="#71717A" />
            </View>
          )}

          {/* Metrics Overlay */}
          <View className="absolute bottom-0 left-0 right-0">
            <BlurView intensity={60} className="overflow-hidden">
              <View className="bg-black/60 p-4">
                <View className="flex-row justify-between">
                  <MetricItem label="Views" value={formatNumber(content.view_count)} />
                  <MetricItem label="Likes" value={formatNumber(content.like_count)} />
                  <MetricItem label="Comments" value={formatNumber(content.comment_count)} />
                  <MetricItem label="Shares" value={formatNumber(content.share_count)} />
                </View>
              </View>
            </BlurView>
          </View>
        </View>

        {/* Content Details */}
        <View className="p-6">
          {/* Revenue Stats */}
          <View className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-6">
            <Text className="text-dark-muted text-sm mb-3">Performance</Text>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-dark-muted text-xs">Total Revenue</Text>
                <Text className="text-success text-2xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(totalRevenue)}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-dark-muted text-xs">EPC</Text>
                <Text className="text-white text-2xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatEPC(epc)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-dark-muted text-xs">Orders</Text>
                <Text className="text-white text-2xl font-bold">
                  {revenue.length}
                </Text>
              </View>
            </View>
          </View>

          {/* Caption */}
          {content.caption && (
            <View className="mb-6">
              <Text className="text-dark-muted text-sm mb-2">Caption</Text>
              <Text className="text-white">{content.caption}</Text>
            </View>
          )}

          {/* Creative Attributes */}
          {attributes && (
            <View className="mb-6">
              <Text className="text-dark-muted text-sm mb-3">Creative Analysis</Text>
              <View className="bg-dark-card border border-dark-border rounded-2xl p-4">
                <View className="flex-row flex-wrap">
                  {attributes.visual_format && (
                    <AttributeChip
                      label="Format"
                      value={getVisualFormatName(attributes.visual_format)}
                    />
                  )}
                  {attributes.hook_strategy && (
                    <AttributeChip
                      label="Hook"
                      value={getHookStrategyName(attributes.hook_strategy)}
                    />
                  )}
                  {attributes.production_style && (
                    <AttributeChip
                      label="Style"
                      value={attributes.production_style}
                    />
                  )}
                </View>

                {/* Quality Scores */}
                <View className="mt-4 space-y-2">
                  {attributes.lighting_quality && (
                    <QualityBar label="Lighting" score={attributes.lighting_quality} />
                  )}
                  {attributes.audio_quality && (
                    <QualityBar label="Audio" score={attributes.audio_quality} />
                  )}
                  {attributes.pacing_score && (
                    <QualityBar label="Pacing" score={attributes.pacing_score} />
                  )}
                  {attributes.product_visibility_score && (
                    <QualityBar
                      label="Product Visibility"
                      score={attributes.product_visibility_score}
                    />
                  )}
                </View>

                {/* Boolean Attributes */}
                <View className="flex-row flex-wrap mt-4">
                  {attributes.has_text_overlay && <BooleanChip label="Text Overlay" />}
                  {attributes.has_music && <BooleanChip label="Music" />}
                  {attributes.has_voiceover && <BooleanChip label="Voiceover" />}
                  {attributes.has_face_visible && <BooleanChip label="Face Visible" />}
                  {attributes.cta_present && <BooleanChip label="CTA" />}
                </View>

                {/* Hook Text */}
                {attributes.hook_text && (
                  <View className="mt-4 p-3 bg-dark-bg rounded-xl">
                    <Text className="text-dark-muted text-xs mb-1">Hook</Text>
                    <Text className="text-white italic">"{attributes.hook_text}"</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Attributed Revenue */}
          {revenue.length > 0 && (
            <View>
              <Text className="text-dark-muted text-sm mb-3">
                Attributed Sales ({revenue.length})
              </Text>
              {revenue.map((event) => (
                <View
                  key={event.id}
                  className="bg-dark-card border border-dark-border rounded-xl p-3 mb-2 flex-row items-center"
                >
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: `${getPlatformColor(event.platform)}20` }}
                  >
                    <Text
                      style={{
                        color: getPlatformColor(event.platform),
                        fontWeight: '600',
                        fontSize: 12,
                      }}
                    >
                      {event.platform.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-sm" numberOfLines={1}>
                      {event.product_name || 'Product'}
                    </Text>
                    <Text className="text-dark-muted text-xs">
                      {event.order_date ? formatDate(event.order_date) : ''}
                    </Text>
                  </View>
                  <Text className="text-success font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    +{formatCurrency(event.commission_amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Posted Date */}
          <View className="mt-6 pt-4 border-t border-dark-border">
            <Text className="text-dark-muted text-sm text-center">
              Posted {content.posted_at ? formatDate(content.posted_at) : 'Unknown'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-white font-bold text-lg">{value}</Text>
      <Text className="text-white/70 text-xs">{label}</Text>
    </View>
  );
}

function AttributeChip({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-dark-bg px-3 py-1.5 rounded-lg mr-2 mb-2">
      <Text className="text-dark-muted text-xs">{label}</Text>
      <Text className="text-white text-sm font-medium capitalize">{value}</Text>
    </View>
  );
}

function BooleanChip({ label }: { label: string }) {
  return (
    <View className="bg-primary-600/20 px-2 py-1 rounded-md mr-2 mb-2">
      <Text className="text-primary-400 text-xs">{label}</Text>
    </View>
  );
}

function QualityBar({ label, score }: { label: string; score: number }) {
  return (
    <View className="flex-row items-center">
      <Text className="text-dark-muted text-xs w-28">{label}</Text>
      <View className="flex-1 flex-row space-x-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i <= score ? 'bg-primary-500' : 'bg-dark-border'
            }`}
          />
        ))}
      </View>
      <Text className="text-white text-xs ml-2 w-4">{score}</Text>
    </View>
  );
}
