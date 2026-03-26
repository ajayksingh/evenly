import React, { useState, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, GROUP_TYPES } from '../constants/colors';
import Avatar from '../components/Avatar';
import { createGroup } from '../services/storage';
import { hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

const CreateGroupScreen = ({ navigation }) => {
  const { user, friends, currency, refresh } = useApp();

  const isWeb = Platform.OS === 'web';
  const screenOpacity = useSharedValue(isWeb ? 1 : 0);
  const screenTranslateY = useSharedValue(isWeb ? 0 : 32);
  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));
  useFocusEffect(useCallback(() => {
    if (!isWeb) {
      screenOpacity.value = 0;
      screenTranslateY.value = 32;
      screenOpacity.value = withTiming(1, { duration: 380 });
      screenTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    }
  }, []));

  const groupNameRef = useRef('');
  const [groupType, setGroupType] = useState('other');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const groupName = groupNameRef.current;
    if (!groupName.trim()) { hapticError(); Alert.alert('Error', 'Enter group name'); return; }
    hapticMedium();
    setCreating(true);
    try {
      const members = [
        { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
        ...selectedMembers,
      ];
      await createGroup({ name: groupName.trim(), type: groupType, members, createdBy: user.id });
      hapticSuccess();
      await refresh();
      navigation.goBack();
    } catch (e) {
      hapticError();
      Alert.alert('Error', e.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'New Group',
      headerStyle: { backgroundColor: 'rgba(10,10,15,0.95)' },
      headerTitleStyle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
      headerLeft: () => (
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity activeOpacity={0.7} onPress={handleCreate} disabled={creating} style={styles.headerBtn}>
          <Text style={[styles.createText, creating && { opacity: 0.5 }]}>Create</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, groupType, selectedMembers, creating]);

  const toggleMember = (friend) => {
    setSelectedMembers(prev =>
      prev.find(m => m.id === friend.id)
        ? prev.filter(m => m.id !== friend.id)
        : [...prev, { id: friend.id, name: friend.name, email: friend.email, avatar: friend.avatar }]
    );
  };

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.fieldLabel}>Group Name</Text>
        <TextInput
          testID="group-name-input"
          style={styles.textInput}
          placeholder="e.g., Goa Trip, Apartment..."
          placeholderTextColor={COLORS.textMuted}
          onChangeText={v => { groupNameRef.current = v; }}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
        />

        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeRow}>
          {GROUP_TYPES.map(t => (
            <TouchableOpacity
              activeOpacity={0.7}
              key={t.id}
              testID={`group-type-${t.id}`}
              style={[styles.typeBtn, groupType === t.id && styles.typeBtnActive]}
              onPress={() => setGroupType(t.id)}
            >
              <Text style={styles.typeEmoji}>{t.emoji}</Text>
              <Text style={[styles.typeLabel, groupType === t.id && styles.typeLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Add Members ({selectedMembers.length} selected)</Text>
        {friends.length === 0 ? (
          <View style={styles.noFriendsBox}>
            <Text style={styles.noFriendsText}>No friends yet — add friends from the Friends tab first.</Text>
          </View>
        ) : (
          friends.map(f => (
            <TouchableOpacity activeOpacity={0.7} key={f.id} style={styles.friendRow} onPress={() => toggleMember(f)}>
              <Avatar name={f.name} size={38} />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{f.name}</Text>
                <Text style={styles.friendEmail}>{f.email}</Text>
              </View>
              <View style={[styles.checkbox, selectedMembers.find(m => m.id === f.id) && styles.checkboxChecked]}>
                {selectedMembers.find(m => m.id === f.id) && <Ionicons name="checkmark" size={14} color="#0a0a0f" />}
              </View>
            </TouchableOpacity>
          ))
        )}
        {Platform.OS === 'web' && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.createBtn, creating && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={styles.createBtnText}>{creating ? 'Creating…' : 'Create Group'}</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20 },
  headerBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  cancelText: { fontSize: 16, color: COLORS.textMuted },
  createText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textLight,
    marginBottom: 10, marginTop: 20,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: COLORS.white, borderRadius: 14,
    padding: 16, fontSize: 16, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  typeLabelActive: { color: '#0a0a0f', fontWeight: '700' },
  noFriendsBox: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  noFriendsText: { fontSize: 14, color: COLORS.textLight, lineHeight: 20 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  friendEmail: { fontSize: 13, color: COLORS.textLight, marginTop: 1 },
  checkbox: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  createBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#0a0a0f' },
});

export default CreateGroupScreen;
