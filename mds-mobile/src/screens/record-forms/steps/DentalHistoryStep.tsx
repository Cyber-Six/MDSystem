/**
 * Dental History Step — Step 3: Dental visits, oral appliances, procedures, photos
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../../context/ThemeContext';
import type { FormData, AllCatalogs } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdate: (data: Partial<FormData['dentalHistory']>) => void;
  isDark: boolean;
  catalogs: AllCatalogs;
}

const CLEANING_RANGES = ['0 to 6 months ago', '7 to 11 months ago', '1 year or more'];

export const DentalHistoryStep: React.FC<Props> = ({ formData, onUpdate, isDark, catalogs }) => {
  const dh = formData.dentalHistory;

  const inputStyle = [styles.input, {
    backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
    color: isDark ? colors.neutral[100] : colors.neutral[900],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
  }];

  const renderYesNo = (label: string, value: string, onSelect: (v: string) => void) => (
    <View style={styles.yesNoRow}>
      <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>{label}</Text>
      <View style={styles.yesNoBtns}>
        {['yes', 'no'].map(v => (
          <TouchableOpacity key={v} style={[styles.yesNoBtn, value === v && styles.yesNoBtnSelected]} onPress={() => onSelect(v)}>
            <Text style={{ color: value === v ? '#FFF' : isDark ? colors.neutral[300] : colors.neutral[600], fontWeight: '600', textTransform: 'capitalize' }}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const handleApplianceToggle = (id: string) => {
    const current = dh.intraOralAppliances[id];
    const isChecked = typeof current === 'object' ? (current as any)?.checked : !!current;
    const arch = typeof current === 'object' ? ((current as any)?.arch || '') : '';
    onUpdate({
      intraOralAppliances: {
        ...dh.intraOralAppliances,
        [id]: { checked: !isChecked, arch },
      },
    });
  };

  const handleApplianceArch = (id: string, arch: string) => {
    const current = dh.intraOralAppliances[id];
    const isChecked = typeof current === 'object' ? !!(current as any)?.checked : !!current;
    onUpdate({
      intraOralAppliances: {
        ...dh.intraOralAppliances,
        [id]: { checked: isChecked, arch },
      },
    });
  };

  const handleProcedureToggle = (id: string) => {
    onUpdate({
      selectedDentalProcedures: {
        ...dh.selectedDentalProcedures,
        [id]: !dh.selectedDentalProcedures[id],
      },
    });
  };

  const pickImage = async (field: 'upperTeethPhoto' | 'lowerTeethPhoto') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required to upload dental photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() || 'jpg';
      onUpdate({
        [field]: { uri: asset.uri, name: `${field}.${ext}`, type: `image/${ext}` },
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental History</Text>

      {/* First time dentist */}
      <View style={[styles.card, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental Visit History</Text>
        {renderYesNo('Is this your first time to be seen by a dentist?', dh.firstTimeDentist, v => onUpdate({ firstTimeDentist: v }))}

        {dh.firstTimeDentist === 'no' && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Last Dental Consultation</Text>
            <TextInput style={inputStyle} value={dh.lastDentalConsultation} onChangeText={v => onUpdate({ lastDentalConsultation: v })}
              placeholder="YYYY-MM" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </View>
        )}

        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginTop: 16 }]}>
          When was your last dental cleaning?
        </Text>
        {CLEANING_RANGES.map(r => (
          <TouchableOpacity key={r} style={styles.radioRow} onPress={() => onUpdate({ lastDentalCleaning: r })}>
            <View style={[styles.radio, dh.lastDentalCleaning === r && styles.radioSelected]}>
              {dh.lastDentalCleaning === r && <View style={styles.radioDot} />}
            </View>
            <Text style={{ color: isDark ? colors.neutral[200] : colors.neutral[800], fontSize: 14 }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Intra-Oral Appliances */}
      <View style={[styles.card, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Intra-Oral Appliances</Text>
        {renderYesNo('Are you wearing any intra-oral appliance?', dh.hasIntraOralAppliance, v => onUpdate({ hasIntraOralAppliance: v }))}

        {dh.hasIntraOralAppliance === 'yes' && (
          <View style={{ marginTop: 12 }}>
            {catalogs.oralApplianceCatalog.map(app => {
              const val = dh.intraOralAppliances[app.id];
              const isChecked = typeof val === 'object' ? !!(val as any)?.checked : !!val;
              const arch = typeof val === 'object' ? ((val as any)?.arch || '') : '';
              return (
                <View key={app.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => handleApplianceToggle(app.id)}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={{ color: isDark ? colors.neutral[100] : colors.neutral[800], fontSize: 14 }}>{app.name}</Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={styles.archRow}>
                      {['Upper', 'Lower', 'Both'].map(loc => (
                        <TouchableOpacity key={loc} style={[styles.archBtn, arch === loc && styles.archBtnSelected]} onPress={() => handleApplianceArch(app.id, loc)}>
                          <Text style={{ color: arch === loc ? '#FFF' : isDark ? colors.neutral[400] : colors.neutral[600], fontSize: 12, fontWeight: '600' }}>{loc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={dh.applianceOther || ''} onChangeText={v => onUpdate({ applianceOther: v })}
              placeholder="Other appliance..." placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </View>
        )}
      </View>

      {/* Dental Procedures */}
      <View style={[styles.card, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental Procedures</Text>
        <Text style={[styles.sublabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
          Which procedures have you had in the past 24 months?
        </Text>
        {catalogs.dentalProcedureCatalog.map(proc => (
          <TouchableOpacity key={proc.id} style={styles.checkRow} onPress={() => handleProcedureToggle(proc.id)}>
            <View style={[styles.checkbox, dh.selectedDentalProcedures[proc.id] && styles.checkboxChecked]}>
              {dh.selectedDentalProcedures[proc.id] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={{ color: isDark ? colors.neutral[100] : colors.neutral[800], fontSize: 14, flex: 1 }}>{proc.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dental Photos */}
      <View style={[styles.card, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental Photos</Text>

        {/* Upper teeth */}
        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Upper Teeth Photo *</Text>
        {dh.upperTeethPhoto?.uri ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: dh.upperTeethPhoto.uri }} style={styles.photoImage} resizeMode="cover" />
            <TouchableOpacity style={styles.changeBtn} onPress={() => pickImage('upperTeethPhoto')}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]} onPress={() => pickImage('upperTeethPhoto')}>
            <Text style={{ color: colors.primary[500], fontWeight: '600' }}>+ Upload Photo</Text>
          </TouchableOpacity>
        )}

        {/* Lower teeth */}
        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginTop: 16 }]}>Lower Teeth Photo *</Text>
        {dh.lowerTeethPhoto?.uri ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: dh.lowerTeethPhoto.uri }} style={styles.photoImage} resizeMode="cover" />
            <TouchableOpacity style={styles.changeBtn} onPress={() => pickImage('lowerTeethPhoto')}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]} onPress={() => pickImage('lowerTeethPhoto')}>
            <Text style={{ color: colors.primary[500], fontWeight: '600' }}>+ Upload Photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  sublabel: { fontSize: 12, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  yesNoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  yesNoBtns: { flexDirection: 'row', gap: 6 },
  yesNoBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  yesNoBtnSelected: { backgroundColor: colors.primary[500] },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingLeft: 8, gap: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.neutral[400], alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary[500] },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary[500] },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.neutral[400], alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  archRow: { flexDirection: 'row', gap: 6, marginLeft: 30, marginBottom: 6 },
  archBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.05)' },
  archBtnSelected: { backgroundColor: colors.primary[500] },
  photoPreview: { marginTop: 8, marginBottom: 12 },
  photoImage: { width: '100%', height: 200, borderRadius: 10 },
  changeBtn: { marginTop: 6, alignSelf: 'flex-start' },
  changeBtnText: { color: colors.primary[500], fontWeight: '600', fontSize: 13 },
  uploadBtn: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 28, alignItems: 'center', marginVertical: 8 },
});

export default DentalHistoryStep;
