import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, GROUP_TYPES } from '../constants/colors';
import Avatar from '../components/Avatar';
import { createGroup, getExpenses } from '../services/storage';
import { formatCurrency } from '../utils/splitCalculator';

const GroupsScreen = ({ navigation }) => {
  const { user, groups, friends, refresh } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('other');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { Alert.alert('Error', 'Enter group name'); return; }
    setCreating(true);
    try {
      const members = [
        { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
        ...selectedMembers,
      ];
      await createGroup({ name: groupName.trim(), type: groupType, members, createdBy: user.id });
      setShowCreate(false);
      setGroupName('');
      setSelectedMembers([]);
      setGroupType('other');
      refresh();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleMember = (friend) => {
    setSelectedMembers(prev =>
      prev.find(m => m.id === friend.id)
        ? prev.filter(m => m.id !== friend.id)
        : [...prev, { id: friend.id, name: friend.name, email: friend.email, avatar: friend.avatar }]
    );
  };

  const renderGroup = ({ item }) => {
    const typeInfo = GROUP_TYPES.find(t => t.id === item.type) || GROUP_TYPES[3];
    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      >
        <View style={[styles.groupIcon, { backgroundColor: COLORS.primaryLight }]}>
          <Ionicons name={typeInfo.icon} size={22} color={COLORS.primary} />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMeta}>{item.members.length} members</Text>
        </View>
        <View style={styles.groupMembersRow}>
          {item.members.slice(0, 3).map((m, idx) => (
            <View key={m.id} style={[styles.memberAvatar, { marginLeft: idx > 0 ? -8 : 0 }]}>
              <Avatar name={m.name} avatar={m.avatar} size={26} />
            </View>
          ))}
          {item.members.length > 3 && (
            <View style={[styles.memberAvatar, styles.memberMore, { marginLeft: -8 }]}>
              <Text style={styles.memberMoreText}>+{item.members.length - 3}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyText}>Create a group to start splitting expenses</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createBtnText}>New Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => item.id}
          renderItem={renderGroup}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Group</Text>
            <TouchableOpacity onPress={handleCreateGroup} disabled={creating}>
              <Text style={[styles.saveText, creating && { opacity: 0.5 }]}>Create</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Group Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Apartment, Road Trip..."
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {GROUP_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeBtn, groupType === t.id && styles.typeBtnActive]}
                onPress={() => setGroupType(t.id)}
              >
                <Ionicons name={t.icon} size={20} color={groupType === t.id ? '#fff' : COLORS.textLight} />
                <Text style={[styles.typeLabel, groupType === t.id && styles.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Add Members ({selectedMembers.length} selected)</Text>
          {friends.length === 0 ? (
            <Text style={styles.noFriendsText}>No friends yet. Add friends first from the Friends tab.</Text>
          ) : (
            friends.map(f => (
              <TouchableOpacity key={f.id} style={styles.friendRow} onPress={() => toggleMember(f)}>
                <Avatar name={f.name} size={36} />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{f.name}</Text>
                  <Text style={styles.friendEmail}>{f.email}</Text>
                </View>
                <View style={[styles.checkbox, selectedMembers.find(m => m.id === f.id) && styles.checkboxChecked]}>
                  {selectedMembers.find(m => m.id === f.id) && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 10,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  groupIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  groupMeta: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  groupMembersRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: { borderWidth: 2, borderColor: COLORS.white, borderRadius: 15 },
  memberMore: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  memberMoreText: { fontSize: 10, color: COLORS.textLight, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptyText: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', marginTop: 8 },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20 },
  createBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  modal: { flex: 1, backgroundColor: COLORS.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelText: { fontSize: 16, color: COLORS.textLight },
  saveText: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: {
    backgroundColor: COLORS.background, borderRadius: 12,
    padding: 14, fontSize: 16, color: COLORS.text,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.background, marginBottom: 8,
  },
  typeBtnActive: { backgroundColor: COLORS.primary },
  typeLabel: { fontSize: 13, color: COLORS.textLight, marginLeft: 6 },
  typeLabelActive: { color: '#fff', fontWeight: '600' },
  noFriendsText: { fontSize: 14, color: COLORS.textLight, fontStyle: 'italic', marginTop: 8 },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  friendEmail: { fontSize: 13, color: COLORS.textLight },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});

export default GroupsScreen;
