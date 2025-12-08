import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { signIn } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/dashboard');
    }

    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-dark-bg"
    >
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <View className="mb-12">
          <Text className="text-4xl font-bold text-white mb-2">
            Creator Pulse
          </Text>
          <Text className="text-lg text-dark-muted">
            Track your creator revenue in one place
          </Text>
        </View>

        {/* Error Message */}
        {error ? (
          <View className="bg-error/10 border border-error rounded-xl p-4 mb-6">
            <Text className="text-error text-center">{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View className="space-y-4">
          <View>
            <Text className="text-dark-muted text-sm mb-2 ml-1">Email</Text>
            <TextInput
              className="bg-dark-card border border-dark-border rounded-xl px-4 py-4 text-white text-base"
              placeholder="you@example.com"
              placeholderTextColor="#71717A"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View>
            <Text className="text-dark-muted text-sm mb-2 ml-1">Password</Text>
            <TextInput
              className="bg-dark-card border border-dark-border rounded-xl px-4 py-4 text-white text-base"
              placeholder="Your password"
              placeholderTextColor="#71717A"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          className={`mt-8 rounded-xl py-4 ${
            isLoading ? 'bg-primary-600/50' : 'bg-primary-600'
          }`}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-base">
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-dark-muted">Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text className="text-primary-500 font-semibold">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
