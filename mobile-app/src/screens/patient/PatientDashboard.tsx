import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const PatientDashboard: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(false);

  const menuItems = [
    { id: 'appointments', title: 'Appointments', icon: '📅', screen: 'Appointments' },
    { id: 'medical-records', title: 'Medical Records', icon: '📋', screen: 'MedicalRecords' },
    { id: 'prescriptions', title: 'Prescriptions', icon: '💊', screen: 'Prescriptions' },
    { id: 'lab-results', title: 'Lab Results', icon: '🔬', screen: 'LabResults' },
    { id: 'documents', title: 'Documents', icon: '📄', screen: 'Documents' },
    { id: 'billing', title: 'Billing', icon: '💳', screen: 'Billing' },
    { id: 'telemedicine', title: 'Telemedicine', icon: '📹', screen: 'Telemedicine' },
    { id: 'messaging', title: 'Messages', icon: '💬', screen: 'PatientMessaging' },
  ];

  const handleNavigate = (screen: string) => {
    (navigation as any).navigate(screen);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back!</Text>
        {user && (
          <Text style={styles.userName}>
            {(user as any).firstName} {(user as any).lastName}
          </Text>
        )}
      </View>

      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleNavigate(item.screen)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuTitle}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userName: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
});

export default PatientDashboard;
