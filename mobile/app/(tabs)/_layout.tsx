import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type IconName = 'pulse' | 'grid' | 'stats-chart' | 'settings';

const TabIcon = ({
  name,
  focused,
}: {
  name: IconName;
  focused: boolean;
}) => (
  <View className={`items-center justify-center ${focused ? 'opacity-100' : 'opacity-50'}`}>
    <Ionicons
      name={name}
      size={24}
      color={focused ? '#0ea5e9' : '#A1A1AA'}
    />
  </View>
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#262626',
          borderTopWidth: 1,
          height: 85,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#A1A1AA',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Pulse',
          tabBarIcon: ({ focused }) => <TabIcon name="pulse" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: 'Content',
          tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Revenue',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="stats-chart" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
