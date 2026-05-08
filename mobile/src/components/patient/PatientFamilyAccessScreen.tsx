import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Pressable, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { ScreenHeader, Card, Badge, Icon, SectionHeader } from '../ui';
import {
  PatientPortalService,
  FamilyAccessGrant,
  GrantFamilyAccessDto,
} from '../../services/patientPortal';

type AccessLevel = 'view_only' | 'full' | 'emergency_only';

const ACCESS_LEVEL_COLORS: Record<AccessLevel, string> = {
  view_only:       C.blue,
  full:            C.teal,
  emergency_only:  C.amber,
};

export const PatientFamilyAccessScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const [grants,         setGrants]         = useState<FamilyAccessGrant[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [revoking,       setRevoking]       = useState<string | null>(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [submitting,     setSubmitting]     = useState(false);

  // Add form state
  const [form, setForm] = useState<GrantFamilyAccessDto>({
    proxyName:   '',
    proxyEmail:  '',
    proxyPhone:  '',
    relationship: '',
    accessLevel: 'view_only',
    expiresAt:   '',
  });

  const loadGrants = useCallback(() => {
    setLoading(true);
    PatientPortalService.getFamilyAccess()
      .then(list => setGrants(list ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGrants(); }, []);

  const handleRevoke = useCallback((id: string, name: string) => {
    Alert.alert(
      t('family.revokeTitle'),
      t('family.revokeConfirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('family.revoke'),
          style: 'destructive',
          onPress: async () => {
            setRevoking(id);
            try {
              await PatientPortalService.revokeFamilyAccess(id);
              setGrants(prev => prev.filter(g => g.id !== id));
            } catch {
              Alert.alert(t('common.error'));
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  }, [t]);

  const handleAdd = useCallback(async () => {
    if (!form.proxyName.trim() || !form.proxyEmail.trim()) {
      Alert.alert(t('family.requiredFields'));
      return;
    }
    setSubmitting(true);
    try {
      const dto: GrantFamilyAccessDto = {
        proxyName:    form.proxyName.trim(),
        proxyEmail:   form.proxyEmail.trim(),
        proxyPhone:   form.proxyPhone?.trim() || undefined,
        relationship: form.relationship?.trim() || undefined,
        accessLevel:  form.accessLevel,
        expiresAt:    form.expiresAt?.trim() || undefined,
      };
      const grant = await PatientPortalService.grantFamilyAccess(dto);
      setGrants(prev => [grant, ...prev]);
      setShowAddModal(false);
      setForm({ proxyName: '', proxyEmail: '', proxyPhone: '', relationship: '', accessLevel: 'view_only', expiresAt: '' });
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }, [form, t]);

  const accessLabel = (level: AccessLevel) => {
    const map: Record<AccessLevel, string> = {
      view_only:      t('family.viewOnly'),
      full:           t('family.fullAccess'),
      emergency_only: t('family.emergencyOnly'),
    };
    return map[level];
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />
      <ScreenHeader
        title={t('family.title')}
        subtitle={t('family.subtitle')}
        accent={C.purple}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Info banner */}
        <Card accent={C.purple} style={styles.infoBanner}>
          <View style={styles.infoRow}>
            <Icon name="shield" size={15} color={C.purple} />
            <Text style={styles.infoText}>{t('family.infoText')}</Text>
          </View>
        </Card>

        {/* Add button */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={16} color={C.purple} />
          <Text style={styles.addBtnText}>{t('family.addCaregiver')}</Text>
        </TouchableOpacity>

        {/* Grants list */}
        <SectionHeader>{t('family.activeGrants')}</SectionHeader>
        {loading ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} />
        ) : grants.length === 0 ? (
          <Text style={styles.emptyText}>{t('family.noGrants')}</Text>
        ) : (
          grants.map(grant => (
            <Card key={grant.id} style={styles.grantCard}>
              <View style={styles.grantTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.grantName}>{grant.proxyName}</Text>
                  <Text style={styles.grantEmail}>{grant.proxyEmail}</Text>
                  {grant.relationship && (
                    <Text style={styles.grantRelationship}>{grant.relationship}</Text>
                  )}
                </View>
                <Badge color={ACCESS_LEVEL_COLORS[grant.accessLevel]} size="sm">
                  {accessLabel(grant.accessLevel)}
                </Badge>
              </View>

              <View style={styles.grantFooter}>
                {grant.expiresAt ? (
                  <Text style={styles.grantExpiry}>
                    {t('family.expires')} {new Date(grant.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                ) : (
                  <Text style={styles.grantExpiry}>{t('family.noExpiry')}</Text>
                )}

                <TouchableOpacity
                  style={[styles.revokeBtn, revoking === grant.id && styles.revokeBtnDisabled]}
                  onPress={() => handleRevoke(grant.id, grant.proxyName)}
                  disabled={revoking === grant.id}
                  activeOpacity={0.8}
                >
                  {revoking === grant.id
                    ? <ActivityIndicator size="small" color={C.red} />
                    : <Text style={styles.revokeBtnText}>{t('family.revoke')}</Text>}
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add caregiver modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('family.addCaregiver')}</Text>

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

            <Text style={styles.fieldLabel}>{t('family.fieldName')} *</Text>
            <TextInput
              style={styles.input}
              value={form.proxyName}
              onChangeText={v => setForm(f => ({ ...f, proxyName: v }))}
              placeholder={t('family.fieldNamePlaceholder')}
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>{t('family.fieldEmail')} *</Text>
            <TextInput
              style={styles.input}
              value={form.proxyEmail}
              onChangeText={v => setForm(f => ({ ...f, proxyEmail: v }))}
              placeholder="email@example.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>{t('family.fieldPhone')}</Text>
            <TextInput
              style={styles.input}
              value={form.proxyPhone}
              onChangeText={v => setForm(f => ({ ...f, proxyPhone: v }))}
              placeholder="+263 77 123 4567"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>{t('family.fieldRelationship')}</Text>
            <TextInput
              style={styles.input}
              value={form.relationship}
              onChangeText={v => setForm(f => ({ ...f, relationship: v }))}
              placeholder={t('family.fieldRelationshipPlaceholder')}
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>{t('family.fieldAccessLevel')}</Text>
            <View style={styles.levelRow}>
              {(['view_only', 'full', 'emergency_only'] as AccessLevel[]).map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelChip,
                    form.accessLevel === level && {
                      backgroundColor: ACCESS_LEVEL_COLORS[level] + '20',
                      borderColor: ACCESS_LEVEL_COLORS[level],
                    },
                  ]}
                  onPress={() => setForm(f => ({ ...f, accessLevel: level }))}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.levelChipText,
                    form.accessLevel === level && { color: ACCESS_LEVEL_COLORS[level] },
                  ]}>
                    {accessLabel(level)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('family.fieldExpiry')}</Text>
            <TextInput
              style={styles.input}
              value={form.expiresAt}
              onChangeText={v => setForm(f => ({ ...f, expiresAt: v }))}
              placeholder="YYYY-MM-DD (optional)"
              placeholderTextColor={C.textMuted}
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, { backgroundColor: C.card, borderColor: C.border }]}
                onPress={() => setShowAddModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.formBtnText, { color: C.textSecondary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, { flex: 1.5, backgroundColor: C.purple }]}
                onPress={handleAdd}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[styles.formBtnText, { color: '#fff' }]}>{t('family.grantAccess')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  infoBanner: { gap: 0 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { flex: 1, fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.purple + '60', borderStyle: 'dashed', backgroundColor: C.purple + '0A' },
  addBtnText: { fontFamily: FONT.uiBd, fontSize: 14, color: C.purple },
  emptyText: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 8 },
  grantCard: { gap: 10 },
  grantTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  grantName: { fontFamily: FONT.uiBk, fontSize: 16, color: C.textPrimary },
  grantEmail: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 2 },
  grantRelationship: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  grantFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  grantExpiry: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  revokeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.red + '50', backgroundColor: C.red + '10' },
  revokeBtnDisabled: { opacity: 0.5 },
  revokeBtnText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.red },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, maxHeight: '88%' },
  modalHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalTitle: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary, letterSpacing: -0.3, paddingHorizontal: 20, paddingVertical: 14 },
  formContent: { paddingHorizontal: 20, paddingTop: 4, gap: 4, paddingBottom: 8 },
  fieldLabel: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2, marginTop: 10 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: FONT.ui, fontSize: 14, color: C.textPrimary, backgroundColor: C.card },
  levelRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  levelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  levelChipText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  formBtn: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, minHeight: 48 },
  formBtnText: { fontFamily: FONT.uiBd, fontSize: 14 },
});
