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
      console.error('Login error:', error);
      // Ensure message is always a string, not an array
      let errorMessage = 'Invalid credentials. Please try again.';
      if (error.response?.data?.message) {
        const msg = error.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : String(msg);
      } else if (error.message) {
        errorMessage = String(error.message);
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

  return (
    <>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Animated Background Gradient */}
        <Animated.View style={[styles.backgroundGradient, { opacity: fadeAnim }]} />

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo Section */}
          <Animated.View
            style={[
              styles.logoSection,
              {
                transform: [{ scale: logoScale }],
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
              <View style={styles.logoImageContainer}>
                <Image
                  source={require('../../../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.logoGlow} />
            </Animated.View>
            <Text style={styles.title}>MediCore</Text>
            <Text style={styles.subtitle}>Healthcare Excellence</Text>
            <View style={styles.titleUnderline} />
          </Animated.View>

          {/* Cached Tenant Badge */}
          {cachedTenant && (
            <Animated.View
              style={[
                styles.tenantBadge,
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              <View style={styles.tenantBadgeContent}>
                <View style={styles.tenantIcon}>
                  <Text style={styles.tenantIconText}>🏥</Text>
                </View>
                <View style={styles.tenantInfo}>
                  <Text style={styles.tenantLabel}>Clinic</Text>
                  <Text style={styles.tenantName} numberOfLines={1}>
                    {cachedTenant.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleChangeTenant}
                  style={styles.changeButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Login Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue</Text>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your.email@example.com"
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
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
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

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Text style={styles.loginButtonIcon}>→</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Change Clinic Link */}
            {cachedTenant && (
              <TouchableOpacity
                style={styles.tenantLink}
                onPress={handleChangeTenant}
                activeOpacity={0.7}
              >
                <Text style={styles.tenantLinkText}>
                  <Text style={styles.tenantLinkIcon}>🔄</Text> Change Clinic
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} MediCore Solutions
            </Text>
            <Text style={styles.footerSubtext}>Built for Zimbabwe's healthcare sector</Text>
          </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
    backgroundColor: colors.backgroundSecondary,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 2,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    opacity: 0.15,
    top: -10,
    left: -10,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 16,
    fontWeight: '300',
  },
  titleUnderline: {
    width: 80,
    height: 4,
    backgroundColor: '#6366f1',
    borderRadius: 2,
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
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
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
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  loginButtonIcon: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  tenantLink: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
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
    marginTop: 32,
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
