import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, useAuthStore } from '../lib/store';
import { savePlatformCredentials } from '../lib/supabase';
import { getPlatformColor, getPlatformName } from '../lib/utils';
import { PlatformType } from '../types/database';

const platforms: { key: PlatformType; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  {
    key: 'amazon',
    icon: 'logo-amazon',
    description: 'Amazon Associates affiliate program',
  },
  {
    key: 'ltk',
    icon: 'heart',
    description: 'LikeToKnowIt creator platform',
  },
  {
    key: 'shopmy',
    icon: 'bag',
    description: 'ShopMy affiliate marketplace',
  },
  {
    key: 'mavely',
    icon: 'trending-up',
    description: 'Mavely creator monetization',
  },
];

export default function Onboarding() {
  const { user } = useAuthStore();
  const {
    currentStep,
    setStep,
    nextStep,
    connectedPlatforms,
    addConnectedPlatform,
  } = useOnboardingStore();

  const steps = [
    { title: 'Welcome', component: WelcomeStep },
    { title: 'Connect Platforms', component: PlatformStep },
    { title: 'All Set', component: CompleteStep },
  ];

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Progress Indicator */}
      <View className="px-6 pt-16 pb-4">
        <View className="flex-row justify-between mb-2">
          {steps.map((step, index) => (
            <View
              key={index}
              className={`h-1 flex-1 rounded-full mx-1 ${
                index <= currentStep ? 'bg-primary-600' : 'bg-dark-border'
              }`}
            />
          ))}
        </View>
        <Text className="text-dark-muted text-sm">
          Step {currentStep + 1} of {steps.length}
        </Text>
      </View>

      <CurrentStepComponent />
    </View>
  );
}

function WelcomeStep() {
  const { nextStep } = useOnboardingStore();
  const { user } = useAuthStore();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      className="flex-1 px-6 justify-center"
    >
      <Text className="text-4xl font-bold text-white mb-4">
        Welcome to{'\n'}Creator Pulse
      </Text>
      <Text className="text-lg text-dark-muted mb-8">
        Track all your affiliate revenue in one place. Get insights into what
        content performs best.
      </Text>

      <View className="space-y-4 mb-12">
        <FeatureItem
          icon="analytics"
          title="Revenue Dashboard"
          description="See all your earnings across platforms"
        />
        <FeatureItem
          icon="bulb"
          title="AI Content Analysis"
          description="Understand what makes your best content work"
        />
        <FeatureItem
          icon="git-compare"
          title="Attribution Tracking"
          description="Link sales to specific posts"
        />
      </View>

      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          nextStep();
        }}
        className="bg-primary-600 py-4 rounded-xl"
      >
        <Text className="text-white text-center font-semibold text-base">
          Get Started
        </Text>
      </TouchableOpacity>
    </MotiView>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-start">
      <View className="w-10 h-10 rounded-xl bg-primary-600/20 items-center justify-center mr-4">
        <Ionicons name={icon} size={20} color="#0ea5e9" />
      </View>
      <View className="flex-1">
        <Text className="text-white font-semibold mb-1">{title}</Text>
        <Text className="text-dark-muted text-sm">{description}</Text>
      </View>
    </View>
  );
}

function PlatformStep() {
  const { user } = useAuthStore();
  const { nextStep, connectedPlatforms, addConnectedPlatform } =
    useOnboardingStore();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(
    null
  );
  const [cookies, setCookies] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!selectedPlatform || !cookies.trim() || !user?.id) return;

    setIsConnecting(true);
    const { error } = await savePlatformCredentials(
      user.id,
      selectedPlatform,
      cookies
    );

    if (!error) {
      addConnectedPlatform(selectedPlatform);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedPlatform(null);
      setCookies('');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setIsConnecting(false);
  };

  return (
    <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
      >
        <Text className="text-3xl font-bold text-white mb-2">
          Connect Your Platforms
        </Text>
        <Text className="text-dark-muted mb-6">
          Connect at least one affiliate platform to start tracking your revenue.
        </Text>

        {/* Platform Selection */}
        <View className="space-y-3 mb-6">
          {platforms.map((platform) => {
            const isConnected = connectedPlatforms.includes(platform.key);
            const isSelected = selectedPlatform === platform.key;

            return (
              <TouchableOpacity
                key={platform.key}
                onPress={() => {
                  if (!isConnected) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlatform(
                      isSelected ? null : platform.key
                    );
                  }
                }}
                className={`p-4 rounded-xl border ${
                  isConnected
                    ? 'bg-success/10 border-success'
                    : isSelected
                    ? 'bg-dark-card border-primary-500'
                    : 'bg-dark-card border-dark-border'
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{
                      backgroundColor: `${getPlatformColor(platform.key)}20`,
                    }}
                  >
                    <Ionicons
                      name={platform.icon}
                      size={20}
                      color={getPlatformColor(platform.key)}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">
                      {getPlatformName(platform.key)}
                    </Text>
                    <Text className="text-dark-muted text-sm">
                      {platform.description}
                    </Text>
                  </View>
                  {isConnected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#22C55E"
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cookie Input (shown when platform selected) */}
        {selectedPlatform && (
          <MotiView
            from={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <View className="bg-dark-card border border-dark-border rounded-xl p-4">
              <Text className="text-white font-semibold mb-2">
                Enter Session Cookies
              </Text>
              <Text className="text-dark-muted text-sm mb-4">
                Paste your {getPlatformName(selectedPlatform)} session cookies.
                We encrypt these securely.
              </Text>
              <TextInput
                className="bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white mb-4"
                placeholder="Paste cookies here..."
                placeholderTextColor="#71717A"
                value={cookies}
                onChangeText={setCookies}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                onPress={handleConnect}
                disabled={isConnecting || !cookies.trim()}
                className={`py-3 rounded-xl ${
                  isConnecting || !cookies.trim()
                    ? 'bg-primary-600/50'
                    : 'bg-primary-600'
                }`}
              >
                {isConnecting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold">
                    Connect {getPlatformName(selectedPlatform)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </MotiView>
        )}

        {/* Continue Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            nextStep();
          }}
          className={`py-4 rounded-xl mb-8 ${
            connectedPlatforms.length > 0
              ? 'bg-primary-600'
              : 'bg-dark-border'
          }`}
        >
          <Text className="text-white text-center font-semibold">
            {connectedPlatforms.length > 0
              ? 'Continue'
              : 'Skip for Now'}
          </Text>
        </TouchableOpacity>
      </MotiView>
    </ScrollView>
  );
}

function CompleteStep() {
  const { connectedPlatforms } = useOnboardingStore();

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/dashboard');
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      className="flex-1 px-6 justify-center items-center"
    >
      <View className="w-20 h-20 rounded-full bg-success/20 items-center justify-center mb-6">
        <Ionicons name="checkmark" size={40} color="#22C55E" />
      </View>

      <Text className="text-3xl font-bold text-white text-center mb-4">
        You're All Set!
      </Text>
      <Text className="text-dark-muted text-center mb-8">
        {connectedPlatforms.length > 0
          ? `You've connected ${connectedPlatforms.length} platform${
              connectedPlatforms.length > 1 ? 's' : ''
            }. We'll start syncing your revenue data.`
          : "You can connect your affiliate platforms later in Settings."}
      </Text>

      <TouchableOpacity
        onPress={handleFinish}
        className="bg-primary-600 py-4 px-12 rounded-xl"
      >
        <Text className="text-white font-semibold text-base">
          Go to Dashboard
        </Text>
      </TouchableOpacity>
    </MotiView>
  );
}
