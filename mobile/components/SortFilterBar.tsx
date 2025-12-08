import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useContentStore } from '../lib/store';
import { getVisualFormatName } from '../lib/utils';

type SortOption = 'epc' | 'revenue' | 'views' | 'date';

const sortOptions: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'epc', label: 'EPC', icon: 'trending-up' },
  { key: 'revenue', label: 'Revenue', icon: 'cash' },
  { key: 'views', label: 'Views', icon: 'eye' },
  { key: 'date', label: 'Date', icon: 'calendar' },
];

const formatOptions = [
  'talking_head',
  'voiceover',
  'product_only',
  'lifestyle',
  'tutorial',
  'unboxing',
  'haul',
  'grwm',
  'review',
];

export default function SortFilterBar() {
  const { sortBy, setSortBy, filterFormat, setFilterFormat } = useContentStore();

  const handleSortChange = (sort: SortOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortBy(sort);
  };

  const handleFilterChange = (format: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilterFormat(format === filterFormat ? null : format);
  };

  return (
    <View className="mb-4">
      {/* Sort Options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 mb-2"
        contentContainerStyle={{ paddingRight: 16 }}
      >
        <View className="flex-row space-x-2">
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => handleSortChange(option.key)}
              className={`flex-row items-center px-3 py-2 rounded-lg ${
                sortBy === option.key
                  ? 'bg-primary-600'
                  : 'bg-dark-card border border-dark-border'
              }`}
            >
              <Ionicons
                name={option.icon}
                size={14}
                color={sortBy === option.key ? 'white' : '#A1A1AA'}
              />
              <Text
                className={`ml-1.5 text-sm font-medium ${
                  sortBy === option.key ? 'text-white' : 'text-dark-muted'
                }`}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Filter Options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4"
        contentContainerStyle={{ paddingRight: 16 }}
      >
        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={() => handleFilterChange(null)}
            className={`px-3 py-1.5 rounded-full ${
              filterFormat === null
                ? 'bg-white/10'
                : 'bg-transparent border border-dark-border'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                filterFormat === null ? 'text-white' : 'text-dark-muted'
              }`}
            >
              All Formats
            </Text>
          </TouchableOpacity>
          {formatOptions.map((format) => (
            <TouchableOpacity
              key={format}
              onPress={() => handleFilterChange(format)}
              className={`px-3 py-1.5 rounded-full ${
                filterFormat === format
                  ? 'bg-white/10'
                  : 'bg-transparent border border-dark-border'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  filterFormat === format ? 'text-white' : 'text-dark-muted'
                }`}
              >
                {getVisualFormatName(format)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
