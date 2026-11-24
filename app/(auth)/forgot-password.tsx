import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useKeyboard } from '../../lib/useKeyboard';
import { LinearGradient } from 'expo-linear-gradient';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetPassword, verifyOtpAndResetPassword } = useAuth();
  const { keyboardHeight, keyboardPaddingBottom } = useKeyboard();

  const scrollViewRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  // Step 1: 'request_otp' | Step 2: 'verify_and_reset'
  const [step, setStep] = useState<'request_otp' | 'verify_and_reset'>('request_otp');

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Automatically scroll when keyboard pops up or active input changes
  useEffect(() => {
    if (keyboardHeight > 0) {
      if (activeField === 'confirmPassword') {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
      } else if (activeField === 'newPassword') {
        setTimeout(() => scrollViewRef.current?.scrollTo({ y: 220, animated: true }), 80);
      }
    }
  }, [keyboardHeight, activeField]);

  // Handle Step 1: Send OTP to email
  const handleSendCode = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { error } = await resetPassword(email.trim());
      if (error) {
        setErrorMsg(error.message || 'Failed to send recovery code. Please check your email.');
      } else {
        setSuccessMsg(`A recovery code has been sent to ${email.trim()}.`);
        setStep('verify_and_reset');
      }
    } catch (err: any) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Verify OTP and set new password
  const handleResetPassword = async () => {
    if (!otpCode.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMsg('Please enter the verification code and your new password.');
      return;
    }

    if (otpCode.trim().length < 6) {
      setErrorMsg('Please enter a valid verification code.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify and try again.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { error } = await verifyOtpAndResetPassword(
        email.trim(),
        otpCode.trim(),
        newPassword
      );

      if (error) {
        setErrorMsg(error.message || 'Invalid or expired code. Please try again.');
      } else {
        setSuccessMsg('Password updated successfully! Redirecting to login...');
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Resend code in Step 2
  const handleResendCode = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await resetPassword(email.trim());
      if (error) {
        setErrorMsg(error.message || 'Failed to resend code. Please try again.');
      } else {
        setSuccessMsg('A new verification code has been sent to your email.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to resend code. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-green-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Fixed Top Bar: Back arrow strictly at top */}
      <View
        style={{ paddingTop: insets.top + 6, paddingHorizontal: 16 }}
        className="flex-row items-center"
      >
        <TouchableOpacity
          onPress={() => {
            if (step === 'verify_and_reset') {
              setStep('request_otp');
              setErrorMsg(null);
              setSuccessMsg(null);
            } else {
              router.back();
            }
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 48,
            height: 48,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: -8,
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#091E15" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + (keyboardPaddingBottom || 48),
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
      >
        <View className="pt-2 pb-6">
          {/* Branding Block */}
          <View className="items-center mb-6">
            <View className="w-[72px] h-[72px] rounded-[36px] bg-light-green items-center justify-center mb-3 shadow-sm">
              <Image
                source={require('../../assets/images/logo.png')}
                className="w-11 h-11"
                resizeMode="contain"
              />
            </View>
            {/* Title token: text-[20px] leading-[22px] font-bold */}
            <Text className="text-[20px] leading-[22px] font-bold text-light-bg-text">
              {step === 'request_otp' ? 'Forgot Password' : 'Enter Verification Code'}
            </Text>

            {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
            {/* Only shown for Step 1. In Step 2, duplicate subtitle is removed as requested */}
            {step === 'request_otp' && (
              <Text className="text-[13px] leading-[15px] font-normal text-light-bg-shade mt-1 text-center px-4">
                Enter your registered email address to receive a recovery code.
              </Text>
            )}
          </View>

          {/* Feedback Messages */}
          {errorMsg && (
            <View className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
              {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
              <Text className="text-[13px] leading-[15px] font-normal text-red-600">
                {errorMsg}
              </Text>
            </View>
          )}

          {successMsg && (
            <View className="p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
              {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
              <Text className="text-[13px] leading-[15px] font-normal text-green-600">
                {successMsg}
              </Text>
            </View>
          )}

          {/* Step 1: Email Form */}
          {step === 'request_otp' && (
            <View className="gap-y-4">
              {/* Email Field */}
              <View className="gap-y-1.5">
                {/* Subtext token: text-[14px] font-normal */}
                <Text className="text-[14px] font-normal text-light-bg-text">
                  Email Address
                </Text>
                <View className="flex-row items-center bg-white border border-light-green rounded-xl px-4 h-[52px]">
                  <TextInput
                    ref={emailRef}
                    className="flex-1 text-[14px] font-normal text-light-bg-text h-full"
                    placeholder="Enter your email"
                    placeholderTextColor="#A0ADB6"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    editable={!loading}
                    accessibilityLabel="Email input for password recovery"
                    returnKeyType="done"
                    onSubmitEditing={handleSendCode}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <View className="mt-2 rounded-[26px] overflow-hidden h-[52px]">
                <LinearGradient
                  colors={loading ? ['#9AE1C9', '#82D2B4'] : ['#02C78E', '#0FB384']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-1"
                >
                  <TouchableOpacity
                    className="flex-1 justify-center items-center"
                    onPress={handleSendCode}
                    disabled={loading}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel="Send Verification Code"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      /* Subtitle token: text-[16px] font-medium */
                      <Text className="text-[16px] font-medium text-white">
                        Send Verification Code
                      </Text>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          )}

          {/* Step 2: Code Verification & Password Reset Form */}
          {step === 'verify_and_reset' && (
            <View className="gap-y-4">
              {/* Code Field */}
              <View className="gap-y-1.5">
                {/* Subtext token: text-[14px] font-normal */}
                <Text className="text-[14px] font-normal text-light-bg-text">
                  Verification Code
                </Text>
                <View className="flex-row items-center bg-white border border-light-green rounded-xl px-4 h-[52px]">
                  <TextInput
                    ref={otpRef}
                    className="flex-1 text-[14px] font-normal text-light-bg-text h-full tracking-widest"
                    placeholder="Enter code"
                    placeholderTextColor="#A0ADB6"
                    keyboardType="number-pad"
                    maxLength={10}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    editable={!loading}
                    accessibilityLabel="Verification code input"
                    returnKeyType="next"
                    onSubmitEditing={() => newPasswordRef.current?.focus()}
                  />
                </View>
              </View>

              {/* New Password Field */}
              <View className="gap-y-1.5">
                {/* Subtext token: text-[14px] font-normal */}
                <Text className="text-[14px] font-normal text-light-bg-text">
                  New Password
                </Text>
                <View className="flex-row items-center bg-white border border-light-green rounded-xl px-4 h-[52px]">
                  <TextInput
                    ref={newPasswordRef}
                    className="flex-1 text-[14px] font-normal text-light-bg-text h-full"
                    placeholder="Enter new password"
                    placeholderTextColor="#A0ADB6"
                    secureTextEntry={!newPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    editable={!loading}
                    accessibilityLabel="New password input"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    onFocus={() => {
                      setActiveField('newPassword');
                      setTimeout(() => scrollViewRef.current?.scrollTo({ y: 220, animated: true }), 120);
                    }}
                    onBlur={() => setActiveField(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setNewPasswordVisible(!newPasswordVisible)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={newPasswordVisible ? 'Hide password' : 'Show password'}
                    style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Ionicons
                      name={newPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm New Password Field */}
              <View className="gap-y-1.5">
                {/* Subtext token: text-[14px] font-normal */}
                <Text className="text-[14px] font-normal text-light-bg-text">
                  Confirm New Password
                </Text>
                <View className="flex-row items-center bg-white border border-light-green rounded-xl px-4 h-[52px]">
                  <TextInput
                    ref={confirmPasswordRef}
                    className="flex-1 text-[14px] font-normal text-light-bg-text h-full"
                    placeholder="Re-enter new password"
                    placeholderTextColor="#A0ADB6"
                    secureTextEntry={!confirmPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    editable={!loading}
                    accessibilityLabel="Confirm password input"
                    returnKeyType="done"
                    onSubmitEditing={handleResetPassword}
                    onFocus={() => {
                      setActiveField('confirmPassword');
                      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
                    }}
                    onBlur={() => setActiveField(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={confirmPasswordVisible ? 'Hide password' : 'Show password'}
                    style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Ionicons
                      name={confirmPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Resend Code & Change Email Row */}
              <View className="flex-row justify-between items-center -mt-1">
                <TouchableOpacity
                  onPress={() => {
                    setStep('request_otp');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  disabled={loading}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Change email"
                  style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }}
                >
                  {/* Subtext token: text-[14px] font-normal */}
                  <Text className="text-[14px] font-normal text-light-bg-shade">
                    Change Email
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={loading}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Resend code"
                  style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }}
                >
                  {/* Subtext token: text-[14px] font-normal */}
                  <Text className="text-[14px] font-normal text-alt-accent">
                    Resend Code
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <View className="mt-2 rounded-[26px] overflow-hidden h-[52px]">
                <LinearGradient
                  colors={loading ? ['#9AE1C9', '#82D2B4'] : ['#02C78E', '#0FB384']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-1"
                >
                  <TouchableOpacity
                    className="flex-1 justify-center items-center"
                    onPress={handleResetPassword}
                    disabled={loading}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel="Reset Password"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      /* Subtitle token: text-[16px] font-medium */
                      <Text className="text-[16px] font-medium text-white">
                        Reset Password
                      </Text>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View className="flex-row justify-center items-center flex-wrap mt-auto pt-4 border-t border-light-green min-h-[48px]">
          {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
          <Text className="text-[13px] leading-[15px] font-normal text-light-bg-shade">
            Remember your password?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Navigate to login screen"
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            {/* Subtitle token: text-[16px] font-medium */}
            <Text className="text-[16px] font-medium text-alt-accent">
              Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
