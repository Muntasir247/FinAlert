import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

// Color definitions from DESIGN.md
const COLORS = {
  bgLight: '#F2FAF7',       // Background Green White and Letters (light greenish-white)
  textPrimary: '#002844',   // Text color for Light BG / Dark variant color
  textSecondary: '#5C6B73', // Shade of Text in Light bg (secondary text)
  lightGreen: '#D1FAE5',    // Light Green brand accent token
  signUpText: '#0A3B29',    // Dark contrast typography for Sign Up button
  loginGradStart: '#0CDA9E',// Button grad start (mint)
  loginGradEnd: '#00A76F',  // Button grad end (emerald)
};

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    // Navigate to the main tab screen
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      
      {/* Animated Fade-in Container for smooth entrance transition */}
      <Animated.View 
        entering={FadeIn.duration(1000)} 
        style={styles.contentContainer}
      >
        {/* Branding Content */}
        <View style={styles.brandSection}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>FinAlert</Text>
          <Text style={styles.subtext}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.
          </Text>
        </View>

        {/* Interactive Actions */}
        <View style={styles.actionSection}>
          {/* Log In Button - Primary with Gradient */}
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={handlePress}
            style={styles.buttonWrapper}
            accessibilityLabel="Log In Button"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[COLORS.loginGradStart, COLORS.loginGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Sign Up Button - Low emphasis with Light Green container */}
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={handlePress}
            style={[styles.buttonWrapper, styles.signUpContainer]}
            accessibilityLabel="Sign Up Button"
            accessibilityRole="button"
          >
            <Text style={styles.signUpText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  brandSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 24,
  },
  title: {
    // Title typography token: 20px leading 22px bold
    fontSize: 20,
    lineHeight: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    // Paragraph typography token: 13px leading 15px normal
    fontSize: 13,
    lineHeight: 15,
    fontWeight: 'normal',
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  actionSection: {
    width: '100%',
    paddingBottom: 40, // Additional padding from bottom
  },
  buttonWrapper: {
    width: '100%',
    height: 52, // Respects tap target (min 48x48dp)
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loginButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    // Subtitle typography token: 16px weight 500 (medium)
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  signUpContainer: {
    backgroundColor: COLORS.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  signUpText: {
    // Subtitle typography token: 16px weight 500 (medium)
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.signUpText,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
});
