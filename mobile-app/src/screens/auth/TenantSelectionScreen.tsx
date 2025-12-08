import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { setCurrentTenant } from '../../store/slices/tenant.slice';
import { storageUtils } from '../../utils/storage';
import { tenantService, Tenant } from '../../services/tenant.service';

const { width } = Dimensions.get('window');

// Separate component for tenant card with animation
const TenantCard: React.FC<{
  item: Tenant;
  index: number;
  isSelecting: boolean;
  onSelect: (tenant: Tenant) => void;
}> = ({ item, index, isSelecting, onSelect }) => {
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.tenantCard,
        {
          opacity: cardAnim,
          transform: [
            {
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.tenantCardContent, isSelecting && styles.tenantCardSelecting]}
        onPress={() => onSelect(item)}
        disabled={isSelecting}
        activeOpacity={0.7}
      >
        {isSelecting ? (
          <View style={styles.selectingContainer}>
            <ActivityIndicator color="#6366f1" size="large" />
            <Text style={styles.selectingText}>Selecting...</Text>
          </View>
        ) : (
          <>
            <View style={styles.tenantHeader}>
              <View style={styles.tenantIconContainer}>
                <Text style={styles.tenantIcon}>🏥</Text>
              </View>
              <View style={styles.tenantInfo}>
                <Text style={styles.tenantName} numberOfLines={1}>
                  {item.clinicName}
                </Text>
                {item.city && (
                  <View style={styles.tenantMeta}>
                    <Text style={styles.tenantLocation}>
                      📍 {item.city}, {item.country}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {item.contactPhone && (
              <View style={styles.tenantFooter}>
                <Text style={styles.tenantPhone}>📞 {item.contactPhone}</Text>
              </View>
            )}
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const TenantSelectionScreen: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dispatch = useDispatch();
  const navigation = useNavigation();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadTenants();
    startAnimations();
  }, []);

  useEffect(() => {
    filterTenants();
  }, [searchQuery, tenants]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const filterTenants = () => {
    if (!searchQuery.trim()) {
      setFilteredTenants(tenants);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tenants.filter(
      (tenant) =>
        tenant.clinicName.toLowerCase().includes(query) ||
        tenant.city?.toLowerCase().includes(query) ||
        tenant.subdomain.toLowerCase().includes(query)
    );
    setFilteredTenants(filtered);
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      const fetchedTenants = await tenantService.getAllTenants();
      setTenants(fetchedTenants);
      setFilteredTenants(fetchedTenants);
    } catch (error: any) {
      console.error('Error loading tenants:', error);
      Alert.alert(
        'Connection Error',
        error.message || 'Failed to load clinics. Please check your connection and try again.',
        [
          {
            text: 'Retry',
            onPress: loadTenants,
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTenant = async (tenant: Tenant) => {
    try {
      setSelecting(tenant.id);

      // Cache the selected tenant
      await storageUtils.cacheTenant({
        id: tenant.id,
        name: tenant.clinicName,
        slug: tenant.subdomain,
        subdomain: tenant.subdomain,
      });

      // Store tenant slug for API calls
      await storageUtils.setTenantSlug(tenant.subdomain);

      // Update Redux store
      dispatch(
        setCurrentTenant({
          id: tenant.id,
          name: tenant.clinicName,
          slug: tenant.subdomain,
        })
      );

      // Navigate to login screen after tenant selection
      navigation.navigate('Login' as never);
    } catch (error: any) {
      console.error('Error selecting tenant:', error);
      Alert.alert('Error', 'Failed to select clinic. Please try again.');
    } finally {
      setSelecting(null);
    }
  };

  const renderTenantCard = ({ item, index }: { item: Tenant; index: number }) => (
    <TenantCard
      item={item}
      index={index}
      isSelecting={selecting === item.id}
      onSelect={handleSelectTenant}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading clinics...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {navigation.canGoBack() && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Select Clinic</Text>
        <Text style={styles.subtitle}>Choose your organization</Text>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, city, or code..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Results Count */}
      {searchQuery.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {filteredTenants.length} {filteredTenants.length === 1 ? 'clinic' : 'clinics'} found
          </Text>
        </View>
      )}

      {/* Tenants List */}
      {filteredTenants.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No Clinics Found</Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'There are no active clinics available at this time.'}
          </Text>
          {searchQuery && (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchText}>Clear Search</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTenants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderTenantCard}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 24,
    paddingTop: 50,
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  backIcon: {
    fontSize: 24,
    color: '#6366f1',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  searchContainer: {
    padding: 16,
    paddingTop: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 18,
    color: '#9ca3af',
  },
  resultsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  clearSearchButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 10,
  },
  clearSearchText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  tenantCard: {
    marginBottom: 12,
  },
  tenantCardContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tenantCardSelecting: {
    opacity: 0.6,
  },
  selectingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  selectingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tenantIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tenantIcon: {
    fontSize: 28,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  tenantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantLocation: {
    fontSize: 14,
    color: '#94a3b8',
  },
  tenantFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tenantPhone: {
    fontSize: 14,
    color: '#94a3b8',
  },
  arrowContainer: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -12,
  },
  arrow: {
    fontSize: 24,
    color: '#6366f1',
    fontWeight: 'bold',
  },
});

export default TenantSelectionScreen;
