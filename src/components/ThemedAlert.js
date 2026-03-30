import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

let _showAlert = null;

const ICONS = {
  success: { name: 'checkmark-circle', color: 'success' },
  error: { name: 'alert-circle', color: 'negative' },
  warning: { name: 'warning', color: 'warning' },
  info: { name: 'information-circle', color: 'info' },
  confirm: { name: 'help-circle', color: 'primary' },
};

export const showThemedAlert = (options) => {
  if (_showAlert) _showAlert(options);
};

export const themedAlert = (title, message, type = 'info') => {
  showThemedAlert({ title, message, type });
};

export const themedConfirm = ({ title, message, confirmText = 'OK', cancelText = 'Cancel', onConfirm, onCancel, destructive = false }) => {
  showThemedAlert({ title, message, confirmText, cancelText, onConfirm, onCancel, destructive, type: 'confirm' });
};

const ThemedAlert = () => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({});
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  _showAlert = useCallback((options) => {
    setConfig(options);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.9);
    }
  }, [visible]);

  const dismiss = (callback) => {
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setVisible(false);
      callback?.();
    });
  };

  const { title, message, type = 'info', confirmText, cancelText, onConfirm, onCancel, destructive } = config;
  const isConfirm = type === 'confirm' || !!onConfirm;
  const iconConfig = ICONS[type] || ICONS.info;
  const iconColor = theme[iconConfig.color] || theme.primary;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => !isConfirm && dismiss()}>
        <Animated.View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, opacity, transform: [{ scale }] }]}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: iconColor + '18' }]}>
                <Ionicons name={iconConfig.name} size={28} color={iconColor} />
              </View>
            </View>
            {title && <Text style={[styles.title, { color: theme.text }]}>{title}</Text>}
            {message && <Text style={[styles.message, { color: theme.textLight }]}>{message}</Text>}
            <View style={styles.buttons}>
              {isConfirm && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.btn, styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={() => dismiss(onCancel)}
                >
                  <Text style={[styles.btnText, { color: theme.textLight }]}>{cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.btn, styles.confirmBtn, { backgroundColor: destructive ? theme.negative : iconColor }]}
                onPress={() => dismiss(isConfirm ? onConfirm : undefined)}
              >
                <Text style={[styles.btnText, { color: '#fff' }]}>{isConfirm ? (confirmText || 'OK') : 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    width: '100%', maxWidth: 340, borderRadius: 20,
    padding: 28, borderWidth: 1,
  },
  iconRow: { alignItems: 'center', marginBottom: 16 },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  buttons: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { borderWidth: 1 },
  confirmBtn: {},
  btnText: { fontSize: 15, fontWeight: '700' },
});

export default ThemedAlert;
