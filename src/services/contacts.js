/**
 * Contacts Service - expo-contacts based
 * Allows importing phone contacts as friends
 */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

let Contacts = null;
if (Platform.OS !== 'web') {
  Contacts = require('expo-contacts');
}

export const requestContactsPermission = async () => {
  if (Platform.OS === 'web') return false;
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

export const getContacts = async () => {
  if (Platform.OS === 'web') return [];
  const granted = await requestContactsPermission();
  if (!granted) throw new Error('Contacts permission denied');

  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.Emails,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Image,
    ],
    sort: Contacts.SortTypes.FirstName,
  });

  // Filter contacts with at least name and phone or email
  return data
    .filter(c => c.name && (c.phoneNumbers?.length > 0 || c.emails?.length > 0))
    .map(c => ({
      id: c.id,
      name: c.name,
      email: c.emails?.[0]?.email || null,
      phone: c.phoneNumbers?.[0]?.number || null,
      avatar: c.image?.uri || null,
    }))
    .slice(0, 200); // Limit to 200 for performance
};

export const searchContacts = async (query) => {
  const contacts = await getContacts();
  const q = query.toLowerCase().trim();
  return contacts.filter(c =>
    c.name?.toLowerCase().includes(q) ||
    c.email?.toLowerCase().includes(q) ||
    c.phone?.includes(q)
  );
};

/**
 * WhatsApp Integration
 * Opens WhatsApp with pre-filled message when an expense is added
 */
export const sendWhatsAppMessage = async (phone, message) => {
  // Clean phone: remove spaces, dashes, parens
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
  const encodedMsg = encodeURIComponent(message);
  const whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
  const webFallback = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

  const canOpen = await Linking.canOpenURL(whatsappUrl);
  if (canOpen) {
    await Linking.openURL(whatsappUrl);
    return true;
  } else {
    // Fallback to web.whatsapp.com
    await Linking.openURL(webFallback);
    return false;
  }
};

export const buildExpenseWhatsAppMessage = ({ expense, paidBy, splitAmount, groupName, currency = 'USD' }) => {
  const symbol = { USD: '$', EUR: '€', GBP: '£', INR: '₹' }[currency] || '$';
  return `💸 *Evenly Expense*\n\n` +
    `*${expense.description}*\n` +
    `Group: ${groupName || 'Personal'}\n` +
    `Paid by: ${paidBy}\n` +
    `Total: ${symbol}${expense.amount.toFixed(2)}\n` +
    `Your share: ${symbol}${splitAmount.toFixed(2)}\n\n` +
    `_Sent via Evenly App_`;
};

export const buildSettlementWhatsAppMessage = ({ payerName, receiverName, amount, currency = 'USD' }) => {
  const symbol = { USD: '$', EUR: '€', GBP: '£', INR: '₹' }[currency] || '$';
  return `✅ *Evenly Payment*\n\n` +
    `${payerName} paid ${receiverName} ${symbol}${amount.toFixed(2)}\n\n` +
    `_Recorded via Evenly App_`;
};
