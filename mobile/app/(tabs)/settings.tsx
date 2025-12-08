import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../lib/store';
import { signOut, getPlatformCredentials } from '../../lib/supabase';
import { getPlatformColor, getPlatformName } from '../../lib/utils';
import { PlatformType, CredentialStatus } from '../../types/database';

type SettingsSection = {
  title: string;
  items: SettingsItem[];
};

type SettingsItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  rightElement?: React.ReactNode;
};

export default function Settings() {
  const { user, setUser } = useAuthStore();
  const [notifications, setNotifications] = useState(true);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
          setUser(null);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const sections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person-outline',
          label: 'Profile',
          value: user?.full_name || user?.email || '',
          onPress: () => router.push('/settings/profile'),
        },
        {
          icon: 'card-outline',
          label: 'Subscription',
          value: user?.subscription_status || 'Free',
          onPress: () => router.push('/settings/subscription'),
        },
      ],
    },
    {
      title: 'Connected Platforms',
      items: [
        {
          icon: 'logo-amazon',
          label: 'Amazon Associates',
          onPress: () => router.push('/settings/platform/amazon'),
        },
        {
          icon: 'heart-outline',
          label: 'LTK',
          onPress: () => router.push('/settings/platform/ltk'),
        },
        {
          icon: 'bag-outline',
          label: 'ShopMy',
          onPress: () => router.push('/settings/platform/shopmy'),
        },
        {
          icon: 'trending-up-outline',
          label: 'Mavely',
          onPress: () => router.push('/settings/platform/mavely'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Push Notifications',
          rightElement: (
            <Switch
              value={notifications}
              onValueChange={(value) => {
                setNotifications(value);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              trackColor={{ false: '#262626', true: '#0ea5e980' }}
              thumbColor={notifications ? '#0ea5e9' : '#71717A'}
            />
          ),
        },
        {
          icon: 'time-outline',
          label: 'Timezone',
          value: user?.timezone || 'America/New_York',
          onPress: () => router.push('/settings/timezone'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Help Center',
          onPress: () => {},
        },
        {
          icon: 'chatbubble-outline',
          label: 'Contact Support',
          onPress: () => {},
        },
        {
          icon: 'document-text-outline',
          label: 'Privacy Policy',
          onPress: () => {},
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Terms of Service',
          onPress: () => {},
        },
      ],
    },
    {
      title: '',
      items: [
        {
          icon: 'log-out-outline',
          label: 'Sign Out',
          onPress: handleSignOut,
          isDestructive: true,
        },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="px-6 pt-16 pb-4">
        <Text className="text-white text-2xl font-bold">Settings</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, sectionIndex) => (
          <View key={sectionIndex} className="mb-6">
            {section.title ? (
              <Text className="text-dark-muted text-sm font-medium px-6 mb-2">
                {section.title}
              </Text>
            ) : null}
            <View className="mx-6 bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  onPress={() => {
                    if (item.onPress) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      item.onPress();
                    }
                  }}
                  disabled={!item.onPress && !item.rightElement}
                  className={`flex-row items-center px-4 py-3.5 ${
                    itemIndex !== section.items.length - 1
                      ? 'border-b border-dark-border'
                      : ''
                  }`}
                  activeOpacity={item.onPress ? 0.7 : 1}
                >
                  <View
                    className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${
                      item.isDestructive ? 'bg-error/10' : 'bg-dark-border'
                    }`}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.isDestructive ? '#EF4444' : '#A1A1AA'}
                    />
                  </View>
                  <Text
                    className={`flex-1 ${
                      item.isDestructive ? 'text-error' : 'text-white'
                    }`}
                  >
                    {item.label}
                  </Text>
                  {item.rightElement ? (
                    item.rightElement
                  ) : item.value ? (
                    <Text className="text-dark-muted text-sm mr-2">
                      {item.value}
                    </Text>
                  ) : null}
                  {item.onPress && !item.rightElement && (
                    <Ionicons name="chevron-forward" size={18} color="#71717A" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* App Version */}
        <Text className="text-dark-muted text-xs text-center">
          Creator Pulse v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
