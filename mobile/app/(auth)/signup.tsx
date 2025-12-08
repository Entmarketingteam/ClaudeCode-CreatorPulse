import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { signUp } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error: signUpError } = await signUp(email, password, fullName);

    if (signUpError) {
      setError(signUpError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/onboarding');
    }

    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-dark-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-4xl font-bold text-white mb-2">
              Join Creator Pulse
            </Text>
            <Text className="text-lg text-dark-muted">
              Start tracking your creator revenue today
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
              <Text className="text-dark-muted text-sm mb-2 ml-1">
                Full Name
              </Text>
              <TextInput
                className="bg-dark-card border border-dark-border rounded-xl px-4 py-4 text-white text-base"
                placeholder="Your name"
                placeholderTextColor="#71717A"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

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
                placeholder="At least 8 characters"
                placeholderTextColor="#71717A"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>

            <View>
              <Text className="text-dark-muted text-sm mb-2 ml-1">
                Confirm Password
              </Text>
              <TextInput
                className="bg-dark-card border border-dark-border rounded-xl px-4 py-4 text-white text-base"
                placeholder="Confirm your password"
                placeholderTextColor="#71717A"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            className={`mt-8 rounded-xl py-4 ${
              isLoading ? 'bg-primary-600/50' : 'bg-primary-600'
            }`}
            onPress={handleSignUp}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-dark-muted">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-primary-500 font-semibold">Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Terms */}
          <Text className="text-dark-muted text-xs text-center mt-8">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
