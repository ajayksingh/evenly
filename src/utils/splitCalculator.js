/**
 * Split Calculator Utilities
 */
import { getCurrencySymbol } from '../services/currency';

export const SPLIT_TYPES = {
  EQUAL: 'equal',
  EXACT: 'exact',
  PERCENTAGE: 'percentage',
  SHARES: 'shares',
};

export const calculateEqualSplit = (amount, members) => {
  const share = parseFloat((amount / members.length).toFixed(2));
  const splits = members.map((m, idx) => ({
    userId: m.id,
    name: m.name,
    amount: idx === 0
      ? parseFloat((amount - share * (members.length - 1)).toFixed(2)) // first gets remainder
      : share,
  }));
  return splits;
};

export const calculatePercentageSplit = (amount, members, percentages) => {
  const baseAmounts = members.map(m =>
    parseFloat(((amount * (percentages[m.id] || 0)) / 100).toFixed(2))
  );
  const diff = parseFloat((amount - baseAmounts.reduce((s, v) => s + v, 0)).toFixed(2));
  return members.map((m, idx) => ({
    userId: m.id,
    name: m.name,
    amount: idx === 0 ? parseFloat((baseAmounts[0] + diff).toFixed(2)) : baseAmounts[idx],
  }));
};

export const calculateSharesSplit = (amount, members, shares) => {
  const totalShares = Object.values(shares).reduce((s, v) => s + v, 0);
  if (totalShares === 0) return calculateEqualSplit(amount, members);
  const baseAmounts = members.map(m =>
    parseFloat(((amount * (shares[m.id] || 0)) / totalShares).toFixed(2))
  );
  const diff = parseFloat((amount - baseAmounts.reduce((s, v) => s + v, 0)).toFixed(2));
  return members.map((m, idx) => ({
    userId: m.id,
    name: m.name,
    amount: idx === 0 ? parseFloat((baseAmounts[0] + diff).toFixed(2)) : baseAmounts[idx],
  }));
};

export const validateExactSplit = (amount, exactAmounts) => {
  const total = Object.values(exactAmounts).reduce((s, v) => s + parseFloat(v || 0), 0);
  return Math.abs(total - amount) < 0.01;
};

export const formatCurrency = (amount, currency = 'INR') => {
  const symbol = getCurrencySymbol(currency);
  const num = parseFloat(amount);
  const formatted = isNaN(num) ? '0.00' : Math.abs(num).toFixed(2);
  return `${symbol}${formatted}`;
};

export const formatBalance = (amount, currency = 'USD') => {
  if (Math.abs(amount) < 0.01) return 'settled up';
  const formatted = formatCurrency(Math.abs(amount), currency);
  if (amount > 0) return `gets back ${formatted}`;
  return `owes ${formatted}`;
};

export const getSimplifiedDebts = (balances) => {
  // Simplify debts using minimum transactions algorithm
  const givers = balances.filter(b => b.amount < 0).map(b => ({ ...b, amount: Math.abs(b.amount) }));
  const receivers = balances.filter(b => b.amount > 0);
  const transactions = [];

  let g = 0, r = 0;
  while (g < givers.length && r < receivers.length) {
    const give = givers[g];
    const receive = receivers[r];
    const amount = Math.min(give.amount, receive.amount);
    if (amount > 0.01) {
      transactions.push({ from: give.userId, to: receive.userId, fromName: give.name, toName: receive.name, amount: parseFloat(amount.toFixed(2)) });
    }
    givers[g].amount -= amount;
    receivers[r].amount -= amount;
    if (givers[g].amount < 0.01) g++;
    if (receivers[r].amount < 0.01) r++;
  }
  return transactions;
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 0) {
      const mins = Math.floor(diff / 60000);
      return mins <= 1 ? 'just now' : `${mins}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const generateAvatarColor = (name) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};
