import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { setCredentials } from '../../store/slices/auth.slice';
import { setCurrentTenant } from '../../store/slices/tenant.slice';
import { storageUtils, CachedTenant } from '../../utils/storage';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import { useAlert } from '../../hooks/useAlert';
import { useToast } from '../../hooks/useToast';
import { colors, shadows } from '../../theme/designSystem';

const { width, height } = Dimensions.get('window');

// Calculate responsive dimensions
const isSmallScreen = height < 700;
const isMediumScreen = height >= 700 && height < 900;
const isLargeScreen = height >= 900;

// Dynamic spacing based on screen size
const getResponsiveSpacing = () => {
  if (isSmallScreen) return { small: 8, medium: 12, large: 16, xlarge: 20 };
  if (isMediumScreen) return { small: 12, medium: 16, large: 24, xlarge: 32 };
  return { small: 16, medium: 20, large: 32, xlarge: 40 };
};

// Dynamic font sizes
const getResponsiveFonts = () => {
  if (isSmallScreen) return { title: 32, subtitle: 16, formTitle: 24, input: 15 };
  if (isMediumScreen) return { title: 38, subtitle: 17, formTitle: 26, input: 16 };
  return { title: 42, subtitle: 18, formTitle: 28, input: 16 };
};

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cachedTenant, setCachedTenant] = useState<CachedTenant | null>(null);
  const [loadingCache, setLoadingCache] = useState(true);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  // Beautiful alerts and toasts
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    loadCachedTenant();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadCachedTenant = async () => {
    try {
      const tenant = await storageUtils.getCachedTenant();
      setCachedTenant(tenant);
    } catch (error) {
      console.error('Error loading cached tenant:', error);
    } finally {
      setLoadingCache(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showToast('Please enter both email and password', 'warning', 'Required Fields');
      return;
    }

    if (!email.includes('@')) {
      showToast('Please enter a valid email address', 'warning', 'Invalid Email');
      return;
    }

    setLoading(true);
    try {
      // Always get tenant from cache (should always be available since we check on app start)
      let tenantSlug = cachedTenant?.subdomain || cachedTenant?.slug;

      // If still no tenant, get from storage directly
      if (!tenantSlug) {
        const storedSlug = await storageUtils.getTenantSlug();
        tenantSlug = storedSlug || undefined;
      }

      // If still no tenant, redirect to selection
      if (!tenantSlug) {
        showToast('Please select a clinic first', 'warning', 'Clinic Required');
        navigation.navigate('TenantSelection' as never);
        setLoading(false);
        return;
      }

      // Ensure tenant is in storage for axios interceptor
      await storageUtils.setTenantSlug(tenantSlug);

      // Login endpoint only accepts email and password in body
      // Tenant is sent via X-Tenant-ID header (handled by axios interceptor)
      // IMPORTANT: Do NOT include tenantSlug in the body
      const loginBody = {
        email,
        password,
      };
      
      // Debug: Log what we're sending
      console.log('🔐 [Login] Sending login request:', {
        body: loginBody,
        tenantSlug: tenantSlug,
        note: 'tenantSlug should be in X-Tenant-ID header, NOT in body',
      });
      
      const response = await ehrApi.post(API_ENDPOINTS.AUTH.LOGIN, loginBody);

      // Handle both 'token' and 'access_token' response formats
      const token = response.token || response.access_token;
      
      if (token && response.user) {
        await storageUtils.setAuthToken(token);
        await storageUtils.setTenantSlug(tenantSlug);

        dispatch(
          setCredentials({
            user: response.user,
            token: token,
          })
        );

        if (cachedTenant) {
          dispatch(
            setCurrentTenant({
              id: cachedTenant.id,
              name: cachedTenant.name,
              slug: cachedTenant.slug,
            })
          );
        }
      } else {
        showAlert('Login Error', 'Invalid response from server. Please try again.', 'error');
      }
    } catch (error: any) {
      // Get tenantSlug for error logging
      let currentTenantSlug: string | undefined;
      try {
        currentTenantSlug = cachedTenant?.subdomain || cachedTenant?.slug || await storageUtils.getTenantSlug() || undefined;
      } catch (e) {
        // Ignore errors getting tenant
      }
      
      console.error('Login error:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        tenantSlug: currentTenantSlug,
      });
      
      // Ensure message is always a string, not an array
      let errorMessage = 'Invalid credentials. Please try again.';
      
      // Handle 401 specifically
      if (error.response?.status === 401) {
        if (error.response?.data?.message) {
          const msg = error.response.data.message;
          errorMessage = Array.isArray(msg) ? msg.join(', ') : String(msg);
        } else {
          errorMessage = 'Authentication failed. Please check your email and password, and ensure the clinic is correct.';
        }
      } else if (error.response?.data?.message) {
        const msg = error.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : String(msg);
      } else if (error.message) {
        errorMessage = String(error.message);
      }
      
      // If it's a network error, provide more helpful message
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend is running and try again.';
      }
      
      showAlert('Login Failed', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTenant = () => {
    storageUtils.clearTenantCache();
    navigation.navigate('TenantSelection' as never);
  };

  if (loadingCache) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const spacing = getResponsiveSpacing();
  const fonts = getResponsiveFonts();

  // Calculate dynamic spacing based on screen height - Ultra compact for small screens
  const logoSectionHeight = isSmallScreen ? Math.min(height * 0.10, 80) : isMediumScreen ? height * 0.13 : height * 0.16;
  const formCardPadding = isSmallScreen ? 10 : isMediumScreen ? 16 : 22;
  const inputSpacing = isSmallScreen ? 8 : isMediumScreen ? 12 : 16;
  const logoSize = isSmallScreen ? 50 : isMediumScreen ? 80 : 110;
  const logoMarginBottom = isSmallScreen ? 4 : isMediumScreen ? 12 : 20;
  const tenantBadgeMarginBottom = isSmallScreen ? 6 : isMediumScreen ? 10 : 14;

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}
      >
        {/* Animated Background Gradient */}
        <Animated.View style={[styles.backgroundGradient, { opacity: fadeAnim }]} />

        <ScrollView
          style={styles.contentWrapper}
          contentContainerStyle={{ height: height, flexGrow: 1 }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Container - Uses flexbox to fit content without scrolling */}
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                flex: 1,
                justifyContent: 'center',
                paddingVertical: isSmallScreen ? 4 : isMediumScreen ? 12 : 20,
                minHeight: height,
                maxHeight: height,
              },
            ]}
          >
            {/* Logo Section - Dynamic sizing - More compact */}
            <Animated.View
              style={[
                styles.logoSection,
                {
                  transform: [{ scale: logoScale }],
                  marginBottom: logoMarginBottom,
                  height: logoSectionHeight,
                  justifyContent: 'center',
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    transform: [{ scale: logoScale }],
                  },
                ]}
              >
                <View style={[styles.logoImageContainer, { width: logoSize, height: logoSize }]}>
                  <Image
                    source={require('../../../assets/logo.png')}
                    style={[styles.logoImage, { width: logoSize, height: logoSize }]}
                    resizeMode="contain"
                  />
                </View>
                <View style={[styles.logoGlow, { width: logoSize + 20, height: logoSize + 20 }]} />
              </Animated.View>
              <Text style={[styles.title, { fontSize: fonts.title, marginBottom: isSmallScreen ? 4 : 8 }]}>MediCore</Text>
              {isLargeScreen && (
                <View style={[styles.subtitleContainer, { marginTop: isSmallScreen ? 4 : 8 }]}>
                  <Text style={[styles.subtitle, { fontSize: fonts.subtitle }]}>Healthcare Excellence</Text>
                  <View style={styles.titleUnderline} />
                </View>
              )}
            </Animated.View>

            {/* Cached Tenant Badge - Compact on small screens */}
            {cachedTenant && (
              <Animated.View
                style={[
                  styles.tenantBadge,
                  {
                    opacity: fadeAnim,
                    marginBottom: tenantBadgeMarginBottom,
                  },
                ]}
              >
                <View style={[styles.tenantBadgeContent, { padding: isSmallScreen ? 10 : 14 }]}>
                  <View style={[styles.tenantIcon, { width: isSmallScreen ? 36 : 44, height: isSmallScreen ? 36 : 44 }]}>
                    <Text style={[styles.tenantIconText, { fontSize: isSmallScreen ? 20 : 24 }]}>🏥</Text>
                  </View>
                  <View style={styles.tenantInfo}>
                    <Text style={[styles.tenantLabel, { fontSize: isSmallScreen ? 10 : 12 }]}>Clinic</Text>
                    <Text style={[styles.tenantName, { fontSize: isSmallScreen ? 13 : 15 }]} numberOfLines={1}>
                      {cachedTenant.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleChangeTenant}
                    style={[styles.changeButton, { paddingHorizontal: isSmallScreen ? 12 : 16, paddingVertical: isSmallScreen ? 6 : 8 }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.changeButtonText, { fontSize: isSmallScreen ? 11 : 13 }]}>Change</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Login Form Card - Dynamic padding and spacing */}
            <View style={[styles.formCard, { padding: formCardPadding }]}>
              <View style={[styles.formHeader, { marginBottom: isSmallScreen ? 20 : 24 }]}>
                <View style={styles.welcomeContainer}>
                  <Text style={[styles.formTitle, { fontSize: fonts.formTitle }]}>Welcome Back</Text>
                  <View style={styles.titleDivider} />
                  <Text style={[styles.formSubtitle, { fontSize: fonts.input }]}>Sign in to continue</Text>
                </View>
              </View>

              {/* Email Input */}
              <View style={[styles.inputWrapper, { marginTop: isSmallScreen ? 16 : 20, marginBottom: inputSpacing }]}>
                <Text style={[styles.inputLabel, { fontSize: isSmallScreen ? 13 : 14 }]}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputIcon}>✉️</Text>
                  <TextInput
                    style={[styles.input, { fontSize: fonts.input }]}
                    placeholder="Enter your email address"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={[styles.inputWrapper, { marginBottom: inputSpacing }]}>
                <Text style={[styles.inputLabel, { fontSize: isSmallScreen ? 13 : 14 }]}>Password</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={[styles.input, styles.passwordInput, { fontSize: fonts.input }]}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button - Always visible */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled, { paddingVertical: isSmallScreen ? 10 : 14 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <>
                    <Text style={[styles.loginButtonText, { fontSize: isSmallScreen ? 15 : 17 }]}>Sign In</Text>
                    <Text style={styles.loginButtonIcon}>→</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Change Clinic Link - Compact spacing */}
              {cachedTenant && (
                <TouchableOpacity
                  style={[styles.tenantLink, { marginTop: isSmallScreen ? 6 : 10 }]}
                  onPress={handleChangeTenant}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tenantLinkText, { fontSize: isSmallScreen ? 12 : 14 }]}>
                    <Text style={styles.tenantLinkIcon}>🔄</Text> Change Clinic
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Footer - Only shown on large screens */}
            {isLargeScreen && (
              <View style={[styles.footer, { marginTop: 12 }]}>
                <Text style={styles.footerText}>
                  © {new Date().getFullYear()} MediCore Solutions
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Beautiful Alerts and Toasts */}
      {AlertComponent}
      {ToastComponent}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentWrapper: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    backgroundColor: colors.backgroundSecondary,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    overflow: 'hidden',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImageContainer: {
    borderRadius: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 2,
  },
  logoImage: {
    borderRadius: 24,
  },
  logoGlow: {
    position: 'absolute',
    borderRadius: 30,
    backgroundColor: '#6366f1',
    opacity: 0.15,
    top: -10,
    left: -10,
  },
  title: {
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitleContainer: {
    alignItems: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  titleUnderline: {
    width: 80,
    height: 4,
    backgroundColor: '#6366f1',
    borderRadius: 2,
    marginTop: 4,
  },
  tenantBadge: {
    marginBottom: 24,
  },
  tenantBadgeContent: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tenantIconText: {
    fontSize: 24,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  changeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  changeButtonText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 20,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  formHeader: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  formTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'none',
  },
  titleDivider: {
    width: 50,
    height: 2,
    backgroundColor: '#6366f1',
    borderRadius: 1,
    marginBottom: 12,
    opacity: 0.7,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  formSubtitle: {
    color: colors.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.4,
    lineHeight: 20,
  },
  inputWrapper: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  passwordInput: {
    paddingRight: 12,
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 20,
  },
  loginButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    marginRight: 8,
  },
  loginButtonIcon: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  tenantLink: {
    marginTop: 0,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tenantLinkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  tenantLinkIcon: {
    marginRight: 6,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});

export default LoginScreen;
