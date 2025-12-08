import { View, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { Skeleton } from 'moti/skeleton';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface SkeletonLoaderProps {
  count?: number;
}

export default function SkeletonLoader({ count = 6 }: SkeletonLoaderProps) {
  return (
    <View className="flex-row flex-wrap justify-between">
      {Array.from({ length: count }).map((_, index) => (
        <MotiView
          key={index}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 300, delay: index * 50 }}
          style={{ width: CARD_WIDTH, marginBottom: 16 }}
        >
          <View className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border">
            {/* Thumbnail Skeleton */}
            <Skeleton
              colorMode="dark"
              colors={['#1a1a1a', '#262626', '#1a1a1a']}
              width="100%"
              height={CARD_WIDTH * (16 / 9)}
            />

            {/* Footer Skeleton */}
            <View className="p-3">
              <View className="flex-row justify-between items-center">
                <Skeleton
                  colorMode="dark"
                  colors={['#1a1a1a', '#262626', '#1a1a1a']}
                  width={60}
                  height={14}
                  radius={4}
                />
                <Skeleton
                  colorMode="dark"
                  colors={['#1a1a1a', '#262626', '#1a1a1a']}
                  width={50}
                  height={14}
                  radius={4}
                />
              </View>
            </View>
          </View>
        </MotiView>
      ))}
    </View>
  );
}

// List Skeleton for content list view
export function ListSkeletonLoader({ count = 5 }: SkeletonLoaderProps) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <MotiView
          key={index}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 300, delay: index * 50 }}
          className="mb-3"
        >
          <View className="flex-row bg-dark-card border border-dark-border rounded-2xl p-3">
            <Skeleton
              colorMode="dark"
              colors={['#1a1a1a', '#262626', '#1a1a1a']}
              width={64}
              height={96}
              radius={12}
            />
            <View className="flex-1 ml-3 justify-between">
              <View>
                <Skeleton
                  colorMode="dark"
                  colors={['#1a1a1a', '#262626', '#1a1a1a']}
                  width="80%"
                  height={16}
                  radius={4}
                />
                <View className="mt-2">
                  <Skeleton
                    colorMode="dark"
                    colors={['#1a1a1a', '#262626', '#1a1a1a']}
                    width="60%"
                    height={12}
                    radius={4}
                  />
                </View>
              </View>
              <View className="flex-row justify-between">
                <Skeleton
                  colorMode="dark"
                  colors={['#1a1a1a', '#262626', '#1a1a1a']}
                  width={50}
                  height={14}
                  radius={4}
                />
                <Skeleton
                  colorMode="dark"
                  colors={['#1a1a1a', '#262626', '#1a1a1a']}
                  width={60}
                  height={14}
                  radius={4}
                />
              </View>
            </View>
          </View>
        </MotiView>
      ))}
    </View>
  );
}

// Revenue Card Skeleton
export function RevenueSkeletonLoader() {
  return (
    <View className="px-6">
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 300 }}
      >
        <View className="bg-dark-card border border-dark-border rounded-2xl p-6 mb-6">
          <Skeleton
            colorMode="dark"
            colors={['#1a1a1a', '#262626', '#1a1a1a']}
            width={120}
            height={16}
            radius={4}
          />
          <View className="mt-2">
            <Skeleton
              colorMode="dark"
              colors={['#1a1a1a', '#262626', '#1a1a1a']}
              width={180}
              height={40}
              radius={4}
            />
          </View>
        </View>
      </MotiView>

      {Array.from({ length: 4 }).map((_, index) => (
        <MotiView
          key={index}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 300, delay: index * 100 }}
          className="mb-3"
        >
          <View className="bg-dark-card border border-dark-border rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Skeleton
                  colorMode="dark"
                  colors={['#1a1a1a', '#262626', '#1a1a1a']}
                  width={12}
                  height={12}
                  radius="round"
                />
                <View className="ml-2">
                  <Skeleton
                    colorMode="dark"
                    colors={['#1a1a1a', '#262626', '#1a1a1a']}
                    width={100}
                    height={16}
                    radius={4}
                  />
                </View>
              </View>
              <Skeleton
                colorMode="dark"
                colors={['#1a1a1a', '#262626', '#1a1a1a']}
                width={70}
                height={16}
                radius={4}
              />
            </View>
            <Skeleton
              colorMode="dark"
              colors={['#1a1a1a', '#262626', '#1a1a1a']}
              width="100%"
              height={8}
              radius={4}
            />
          </View>
        </MotiView>
      ))}
    </View>
  );
}
