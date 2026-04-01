import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { themedAlert } from '../components/ThemedAlert';
import { confirmAlert } from '../utils/alert';
import { getConnectedAccounts, connectAccount, disconnectAccount } from '../services/expenseTracker';
import { requestSMSPermission, hasSMSPermission } from '../services/smsReader';
import { getFlagSync } from '../services/flags';

const ConnectedAccountsScreen = ({ navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useApp();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getConnectedAccounts(user.id);
      setAccounts(data);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const smsConnected = accounts.find(a => a.type === 'sms' && a.status === 'active');
  const emailConnected = accounts.find(a => a.type === 'gmail' && a.status === 'active');
  const smsEnabled = getFlagSync('sms_expense_tracking');
  const emailEnabled = getFlagSync('email_expense_tracking');

  const handleConnectSMS = async () => {
    if (Platform.OS === 'web') {
      themedAlert('Not Available', 'SMS tracking is only available on Android.', 'info');
      return;
    }
    setConnecting('sms');
    try {
      const granted = await requestSMSPermission();
      if (granted) {
        await connectAccount(user.id, 'sms');
        themedAlert('SMS Connected', 'Bank transaction SMS will now be tracked automatically.', 'success');
        loadAccounts();
      } else {
        themedAlert('Permission Denied', 'SMS permission is required to read bank transaction alerts.', 'warning');
      }
    } catch (e) {
      themedAlert('Error', e.message, 'error');
    }
    setConnecting(null);
  };

  const handleConnectEmail = () => {
    themedAlert('Coming Soon', 'Gmail integration is coming in the next update.', 'info');
  };

  const handleDisconnect = (account) => {
    confirmAlert({
      title: 'Disconnect',
      message: `This will remove all ${account.type === 'sms' ? 'SMS' : 'email'}-sourced expenses. Continue?`,
      confirmText: 'Disconnect',
      destructive: true,
      onConfirm: async () => {
        try {
          await disconnectAccount(account.id, user.id);
          themedAlert('Disconnected', 'Source removed and related expenses deleted.', 'success');
          loadAccounts();
        } catch (e) {
          themedAlert('Error', e.message, 'error');
        }
      },
    });
  };

  const AccountCard = ({ icon, iconColor, title, subtitle, status, onAction, actionLabel, actionColor, disabled, badge }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.cardIcon, { backgroundColor: iconColor + '18' }]}>
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        <View style={styles.cardInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            {badge && (
              <View style={[styles.badge, { backgroundColor: theme.info + '20' }]}>
                <Text style={[styles.badgeText, { color: theme.info }]}>{badge}</Text>
              </View>
            )}
          </View>
          {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
          {status && <Text style={styles.cardStatus}>{status}</Text>}
        </View>
      </View>
      {onAction && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionBtn, { backgroundColor: (actionColor || theme.primary) + '18', opacity: disabled ? 0.5 : 1 }]}
          onPress={onAction}
          disabled={disabled || connecting !== null}
        >
          {connecting === title.toLowerCase() ? (
            <ActivityIndicator size="small" color={actionColor || theme.primary} />
          ) : (
            <Text style={[styles.actionBtnText, { color: actionColor || theme.primary }]}>{actionLabel}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Sources</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Connected */}
        {(smsConnected || emailConnected) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected</Text>
            {smsConnected && (
              <AccountCard
                icon="phone-portrait-outline"
                iconColor={theme.primary}
                title="SMS (Bank Alerts)"
                subtitle="Auto-tracking bank transaction SMS"
                status={`Active · Last sync: ${smsConnected.last_sync_at ? new Date(smsConnected.last_sync_at).toLocaleDateString() : 'Never'}`}
                onAction={() => handleDisconnect(smsConnected)}
                actionLabel="Disconnect"
                actionColor={theme.negative}
              />
            )}
            {emailConnected && (
              <AccountCard
                icon="mail-outline"
                iconColor={theme.info}
                title="Gmail"
                subtitle={emailConnected.email}
                status="Active"
                onAction={() => handleDisconnect(emailConnected)}
                actionLabel="Disconnect"
                actionColor={theme.negative}
              />
            )}
          </View>
        )}

        {/* Available */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Sources</Text>
          {!smsConnected && (
            <AccountCard
              icon="phone-portrait-outline"
              iconColor={theme.primary}
              title="SMS (Bank Alerts)"
              subtitle="Read bank transaction SMS to auto-track expenses"
              onAction={smsEnabled ? handleConnectSMS : null}
              actionLabel="Connect"
              disabled={Platform.OS === 'web'}
              badge={!smsEnabled ? 'Coming Soon' : Platform.OS === 'web' ? 'Android Only' : null}
            />
          )}
          {!emailConnected && (
            <AccountCard
              icon="mail-outline"
              iconColor={theme.info}
              title="Gmail"
              subtitle="Read transaction emails and credit card statements"
              onAction={handleConnectEmail}
              actionLabel="Connect"
              badge={!emailEnabled ? 'Coming Soon' : null}
            />
          )}
          <AccountCard
            icon="logo-windows"
            iconColor={theme.secondary}
            title="Outlook"
            subtitle="Microsoft email integration"
            badge="Coming Soon"
          />
        </View>

        {/* Privacy */}
        <View style={styles.privacyBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
          <Text style={styles.privacyText}>
            Evenly reads transactions only. We never read personal emails or send messages. All parsing happens on your device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 16 : 52, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  card: {
    backgroundColor: theme.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border, marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  cardSubtitle: { fontSize: 12, color: theme.textLight, marginTop: 2 },
  cardStatus: { fontSize: 11, color: theme.primary, marginTop: 4, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actionBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  privacyBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.primaryLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: theme.primary + '20',
  },
  privacyText: { flex: 1, fontSize: 12, color: theme.textLight, lineHeight: 18 },
});

export default ConnectedAccountsScreen;
