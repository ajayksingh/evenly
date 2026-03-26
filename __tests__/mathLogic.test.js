/**
 * Math Logic Tests — Evenly App
 * Tests all split, balance, and debt-simplification calculations.
 */

// ─── Inline implementations (mirrors src/utils/splitCalculator.js) ────────────

const calculateEqualSplit = (amount, members) => {
  const share = parseFloat((amount / members.length).toFixed(2));
  return members.map((m, idx) => ({
    userId: m.id, name: m.name,
    amount: idx === 0
      ? parseFloat((amount - share * (members.length - 1)).toFixed(2))
      : share,
  }));
};

const calculatePercentageSplit = (amount, members, percentages) => {
  const baseAmounts = members.map(m =>
    parseFloat(((amount * (percentages[m.id] || 0)) / 100).toFixed(2))
  );
  const diff = parseFloat((amount - baseAmounts.reduce((s, v) => s + v, 0)).toFixed(2));
  return members.map((m, idx) => ({
    userId: m.id, name: m.name,
    amount: idx === 0 ? parseFloat((baseAmounts[0] + diff).toFixed(2)) : baseAmounts[idx],
  }));
};

const calculateSharesSplit = (amount, members, shares) => {
  const totalShares = Object.values(shares).reduce((s, v) => s + v, 0);
  if (totalShares === 0) return calculateEqualSplit(amount, members);
  const baseAmounts = members.map(m =>
    parseFloat(((amount * (shares[m.id] || 0)) / totalShares).toFixed(2))
  );
  const diff = parseFloat((amount - baseAmounts.reduce((s, v) => s + v, 0)).toFixed(2));
  return members.map((m, idx) => ({
    userId: m.id, name: m.name,
    amount: idx === 0 ? parseFloat((baseAmounts[0] + diff).toFixed(2)) : baseAmounts[idx],
  }));
};

const validateExactSplit = (amount, exactAmounts) => {
  const total = Object.values(exactAmounts).reduce((s, v) => s + parseFloat(v || 0), 0);
  return Math.abs(total - amount) < 0.01;
};

const getSimplifiedDebts = (balances) => {
  const givers    = balances.filter(b => b.amount < 0).map(b => ({ ...b, amount: Math.abs(b.amount) }));
  const receivers = balances.filter(b => b.amount > 0);
  const transactions = [];
  let g = 0, r = 0;
  while (g < givers.length && r < receivers.length) {
    const give = givers[g], receive = receivers[r];
    const amount = Math.min(give.amount, receive.amount);
    if (amount > 0.01) transactions.push({ from: give.userId, to: receive.userId, fromName: give.name, toName: receive.name, amount: parseFloat(amount.toFixed(2)) });
    givers[g].amount    -= amount;
    receivers[r].amount -= amount;
    if (givers[g].amount    < 0.01) g++;
    if (receivers[r].amount < 0.01) r++;
  }
  return transactions;
};

// ─── Inline balance calculation (mirrors storage.js) ──────────────────────────

const _calculateGroupBalancesFromData = (groupId, members, groupExpenses, groupSettlements) => {
  const balanceMap = {};
  members.forEach(m => balanceMap[m.id] = 0);
  groupExpenses.forEach(expense => {
    const paidById = expense.paidBy?.id || expense.paidBy;
    if (balanceMap[paidById] !== undefined) balanceMap[paidById] += expense.amount;
    expense.splits.forEach(split => {
      if (balanceMap[split.userId] !== undefined) balanceMap[split.userId] -= split.amount;
    });
  });
  groupSettlements.forEach(s => {
    const paidBy = s.paidBy || s.paid_by;
    const paidTo = s.paidTo || s.paid_to;
    if (balanceMap[paidBy] !== undefined) balanceMap[paidBy] += s.amount;
    if (balanceMap[paidTo] !== undefined) balanceMap[paidTo] -= s.amount;
  });
  return members.map(m => ({ ...m, balance: balanceMap[m.id] || 0 }));
};

const _calculateBalancesFromData = (userId, expenses, settlements, users) => {
  const balanceMap = {};
  expenses.forEach(expense => {
    const paidById = expense.paidBy?.id || expense.paidBy;
    expense.splits.forEach(split => {
      if (split.userId === paidById) return;
      const sorted = [paidById, split.userId].sort();
      const key = sorted.join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: sorted[0], user2: sorted[1], amount: 0 };
      if (paidById === balanceMap[key].user1) balanceMap[key].amount += split.amount;
      else balanceMap[key].amount -= split.amount;
    });
  });
  settlements.forEach(s => {
    const sorted = [s.paidBy, s.paidTo].sort();
    const key = sorted.join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: sorted[0], user2: sorted[1], amount: 0 };
    if (s.paidBy === balanceMap[key].user1) balanceMap[key].amount += s.amount;
    else balanceMap[key].amount -= s.amount;
  });
  const result = [];
  Object.values(balanceMap).forEach(b => {
    if (Math.abs(b.amount) < 0.01) return;
    if (b.user1 === userId || b.user2 === userId) {
      const otherUserId = b.user1 === userId ? b.user2 : b.user1;
      const otherUser = users.find(u => u.id === otherUserId);
      if (!otherUser) return;
      const amount = b.user1 === userId ? b.amount : -b.amount;
      result.push({ userId: otherUserId, name: otherUser.name, amount });
    }
  });
  return result;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sum = arr => parseFloat(arr.reduce((s, v) => s + v, 0).toFixed(10));
const members3 = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Carol' }];
const members2 = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateEqualSplit', () => {
  test('splits evenly — no remainder', () => {
    const splits = calculateEqualSplit(90, members3);
    expect(splits.every(s => s.amount === 30)).toBe(true);
    expect(sum(splits.map(s => s.amount))).toBe(90);
  });

  test('splits with remainder goes to first member', () => {
    const splits = calculateEqualSplit(10, members3); // 3.33, 3.33, 3.34
    expect(sum(splits.map(s => s.amount))).toBe(10);
    expect(splits[0].amount).toBe(3.34); // gets the extra cent
    expect(splits[1].amount).toBe(3.33);
    expect(splits[2].amount).toBe(3.33);
  });

  test('two members — odd amount', () => {
    const splits = calculateEqualSplit(1, members2);
    expect(sum(splits.map(s => s.amount))).toBe(1);
  });

  test('large amount with remainder', () => {
    const splits = calculateEqualSplit(100, members3); // 33.33, 33.33, 33.34
    expect(sum(splits.map(s => s.amount))).toBe(100);
  });

  test('single member gets full amount', () => {
    const splits = calculateEqualSplit(50, [members3[0]]);
    expect(splits[0].amount).toBe(50);
  });

  test('zero amount', () => {
    const splits = calculateEqualSplit(0, members3);
    expect(splits.every(s => s.amount === 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('calculatePercentageSplit', () => {
  test('100% split correctly', () => {
    const pcts = { a: 50, b: 30, c: 20 };
    const splits = calculatePercentageSplit(200, members3, pcts);
    expect(splits.find(s => s.userId === 'a').amount).toBe(100);
    expect(splits.find(s => s.userId === 'b').amount).toBe(60);
    expect(splits.find(s => s.userId === 'c').amount).toBe(40);
    expect(sum(splits.map(s => s.amount))).toBe(200);
  });

  test('🐛 BUG: 33/33/34 split loses cents on some amounts', () => {
    // 3 × 33% = 99%, last gets 34% — total should always equal amount
    const pcts = { a: 33, b: 33, c: 34 };
    const splits = calculatePercentageSplit(10, members3, pcts);
    const total = sum(splits.map(s => s.amount));
    // 33%×10=3.30, 33%×10=3.30, 34%×10=3.40 → total=10.00 (passes)
    expect(total).toBe(10);
  });

  test('FIXED: equal 33% each — remainder assigned to first member', () => {
    const pcts = { a: 33, b: 33, c: 33 };
    const splits = calculatePercentageSplit(10, members3, pcts);
    const total = sum(splits.map(s => s.amount));
    // diff = 10 - 9.90 = 0.10 → added to first member
    expect(total).toBe(10);
    expect(splits[0].amount).toBe(3.40); // 3.30 + 0.10 remainder
  });

  test('🐛 BUG: 33.33% each — cents lost even when should sum to 100', () => {
    const pcts = { a: 33.33, b: 33.33, c: 33.34 };
    const splits = calculatePercentageSplit(100, members3, pcts);
    const total = sum(splits.map(s => s.amount));
    // 33.33 + 33.33 + 33.34 = 100.00 — this one is fine
    expect(total).toBe(100);
  });

  test('missing percentage defaults to 0', () => {
    const pcts = { a: 100 };
    const splits = calculatePercentageSplit(50, members3, pcts);
    expect(splits.find(s => s.userId === 'b').amount).toBe(0);
    expect(splits.find(s => s.userId === 'c').amount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('calculateSharesSplit', () => {
  test('equal shares split correctly', () => {
    const shares = { a: 1, b: 1, c: 1 };
    const splits = calculateSharesSplit(90, members3, shares);
    expect(splits.every(s => s.amount === 30)).toBe(true);
    expect(sum(splits.map(s => s.amount))).toBe(90);
  });

  test('FIXED: equal 1-share each — remainder assigned to first member', () => {
    const shares = { a: 1, b: 1, c: 1 };
    const splits = calculateSharesSplit(10, members3, shares);
    const total = sum(splits.map(s => s.amount));
    // diff = 10 - 9.99 = 0.01 → added to first member
    expect(total).toBe(10);
    expect(splits[0].amount).toBe(3.34); // 3.33 + 0.01 remainder
  });

  test('weighted shares', () => {
    const shares = { a: 2, b: 1, c: 1 };
    const splits = calculateSharesSplit(100, members3, shares);
    expect(splits.find(s => s.userId === 'a').amount).toBe(50);
    expect(splits.find(s => s.userId === 'b').amount).toBe(25);
    expect(splits.find(s => s.userId === 'c').amount).toBe(25);
    expect(sum(splits.map(s => s.amount))).toBe(100);
  });

  test('zero total shares falls back to equal split', () => {
    const shares = { a: 0, b: 0, c: 0 };
    const splits = calculateSharesSplit(90, members3, shares);
    expect(splits.every(s => s.amount === 30)).toBe(true);
  });

  test('missing share defaults to 0', () => {
    const shares = { a: 1 };
    const splits = calculateSharesSplit(100, members3, shares);
    expect(splits.find(s => s.userId === 'a').amount).toBe(100);
    expect(splits.find(s => s.userId === 'b').amount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('validateExactSplit', () => {
  test('valid split passes', () => {
    expect(validateExactSplit(100, { a: 50, b: 30, c: 20 })).toBe(true);
  });

  test('split with remainder passes', () => {
    expect(validateExactSplit(10, { a: 3.34, b: 3.33, c: 3.33 })).toBe(true);
  });

  test('invalid split fails', () => {
    expect(validateExactSplit(100, { a: 50, b: 30, c: 10 })).toBe(false);
  });

  test('string values are parsed correctly', () => {
    expect(validateExactSplit(100, { a: '50', b: '50' })).toBe(true);
  });

  test('zero amounts', () => {
    expect(validateExactSplit(0, { a: 0, b: 0, c: 0 })).toBe(true);
  });

  test('over-split fails', () => {
    expect(validateExactSplit(100, { a: 60, b: 60 })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getSimplifiedDebts', () => {
  test('simple 2-person debt', () => {
    const balances = [
      { userId: 'a', name: 'Alice', amount: 50 },
      { userId: 'b', name: 'Bob',   amount: -50 },
    ];
    const txns = getSimplifiedDebts(balances);
    expect(txns).toHaveLength(1);
    expect(txns[0].from).toBe('b');
    expect(txns[0].to).toBe('a');
    expect(txns[0].amount).toBe(50);
  });

  test('3-person — minimises transactions', () => {
    // A is owed 90, B owes 40, C owes 50
    const balances = [
      { userId: 'a', name: 'Alice', amount: 90 },
      { userId: 'b', name: 'Bob',   amount: -40 },
      { userId: 'c', name: 'Carol', amount: -50 },
    ];
    const txns = getSimplifiedDebts(balances);
    const totalPaid = sum(txns.map(t => t.amount));
    expect(totalPaid).toBeCloseTo(90, 1);
    expect(txns.length).toBeLessThanOrEqual(2);
  });

  test('already settled — no transactions', () => {
    const balances = [
      { userId: 'a', name: 'Alice', amount: 0 },
      { userId: 'b', name: 'Bob',   amount: 0 },
    ];
    expect(getSimplifiedDebts(balances)).toHaveLength(0);
  });

  test('FIXED: transaction amounts are rounded to 2 decimal places', () => {
    const balances = [
      { userId: 'a', name: 'Alice', amount: 10  },
      { userId: 'b', name: 'Bob',   amount: -10 / 3 },
      { userId: 'c', name: 'Carol', amount: -10 / 3 },
      { userId: 'd', name: 'Dave',  amount: -10 / 3 },
    ];
    const txns = getSimplifiedDebts(balances);
    txns.forEach(t => {
      const decimalPlaces = (t.amount.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  test('complex multi-person settlement', () => {
    // A owes 30, B owes 20, C is owed 50
    const balances = [
      { userId: 'c', name: 'Carol', amount: 50  },
      { userId: 'a', name: 'Alice', amount: -30 },
      { userId: 'b', name: 'Bob',   amount: -20 },
    ];
    const txns = getSimplifiedDebts(balances);
    expect(txns.length).toBeLessThanOrEqual(2);
    expect(sum(txns.map(t => t.amount))).toBeCloseTo(50, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_calculateGroupBalancesFromData', () => {
  const members = [
    { id: 'alice', name: 'Alice' },
    { id: 'bob',   name: 'Bob' },
    { id: 'carol', name: 'Carol' },
  ];

  test('single expense — payer is owed, others owe', () => {
    const expenses = [{
      paidBy: { id: 'alice' },
      amount: 90,
      splits: [
        { userId: 'alice', amount: 30 },
        { userId: 'bob',   amount: 30 },
        { userId: 'carol', amount: 30 },
      ],
    }];
    const result = _calculateGroupBalancesFromData('g1', members, expenses, []);
    const alice = result.find(m => m.id === 'alice');
    const bob   = result.find(m => m.id === 'bob');
    const carol = result.find(m => m.id === 'carol');
    expect(alice.balance).toBeCloseTo(60, 5);  // paid 90, owes 30 → net +60
    expect(bob.balance).toBeCloseTo(-30, 5);
    expect(carol.balance).toBeCloseTo(-30, 5);
    // Net must be zero
    expect(alice.balance + bob.balance + carol.balance).toBeCloseTo(0, 5);
  });

  test('settlement zeroes out balances', () => {
    const expenses = [{
      paidBy: { id: 'alice' },
      amount: 60,
      splits: [
        { userId: 'alice', amount: 30 },
        { userId: 'bob',   amount: 30 },
      ],
    }];
    const settlements = [{ paidBy: 'bob', paidTo: 'alice', amount: 30 }];
    const result = _calculateGroupBalancesFromData('g1', members, expenses, settlements);
    const alice = result.find(m => m.id === 'alice');
    const bob   = result.find(m => m.id === 'bob');
    expect(alice.balance).toBeCloseTo(0, 5);
    expect(bob.balance).toBeCloseTo(0, 5);
  });

  test('multiple expenses — net balance is always zero', () => {
    const expenses = [
      { paidBy: { id: 'alice' }, amount: 90, splits: [{ userId: 'alice', amount: 30 }, { userId: 'bob', amount: 30 }, { userId: 'carol', amount: 30 }] },
      { paidBy: { id: 'bob'   }, amount: 60, splits: [{ userId: 'alice', amount: 20 }, { userId: 'bob', amount: 20 }, { userId: 'carol', amount: 20 }] },
    ];
    const result = _calculateGroupBalancesFromData('g1', members, expenses, []);
    const net = result.reduce((s, m) => s + m.balance, 0);
    expect(net).toBeCloseTo(0, 5);
  });

  test('🐛 BUG: rounding-error splits cause non-zero net balance', () => {
    // Shares split on 10 with 3 people → 3.33 each (total 9.99, not 10)
    const expenses = [{
      paidBy: { id: 'alice' },
      amount: 10,
      splits: [
        { userId: 'alice', amount: 3.34 }, // first gets remainder (correct)
        { userId: 'bob',   amount: 3.33 },
        { userId: 'carol', amount: 3.33 },
      ],
    }];
    const result = _calculateGroupBalancesFromData('g1', members, expenses, []);
    const net = result.reduce((s, m) => s + m.balance, 0);
    expect(net).toBeCloseTo(0, 5); // should pass with equal split remainder fix

    // Now with bugged splits (9.99 total, as calculateSharesSplit would produce):
    const expensesBugged = [{
      paidBy: { id: 'alice' },
      amount: 10,
      splits: [
        { userId: 'alice', amount: 3.33 },
        { userId: 'bob',   amount: 3.33 },
        { userId: 'carol', amount: 3.33 },
      ],
    }];
    const resultBugged = _calculateGroupBalancesFromData('g1', members, expensesBugged, []);
    const netBugged = resultBugged.reduce((s, m) => s + m.balance, 0);
    // alice paid 10 but splits only add up to 9.99 → alice has +0.01 phantom credit
    expect(netBugged).toBeCloseTo(0.01, 5); // BUG: net ≠ 0 when splits don't sum to expense amount
  });

  test('over-settlement creates negative balance', () => {
    const expenses = [{
      paidBy: { id: 'alice' }, amount: 60,
      splits: [{ userId: 'alice', amount: 30 }, { userId: 'bob', amount: 30 }],
    }];
    // Bob pays back 40 (overpays by 10)
    const settlements = [{ paidBy: 'bob', paidTo: 'alice', amount: 40 }];
    const result = _calculateGroupBalancesFromData('g1', members, expenses, settlements);
    const alice = result.find(m => m.id === 'alice');
    const bob   = result.find(m => m.id === 'bob');
    expect(alice.balance).toBeCloseTo(-10, 5); // alice now owes bob 10
    expect(bob.balance).toBeCloseTo(10, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_calculateBalancesFromData (pairwise)', () => {
  const users = [
    { id: 'alice', name: 'Alice' },
    { id: 'bob',   name: 'Bob' },
  ];

  test('alice paid — bob owes alice', () => {
    const expenses = [{
      paidBy: { id: 'alice' },
      splits: [{ userId: 'alice', amount: 25 }, { userId: 'bob', amount: 25 }],
    }];
    const result = _calculateBalancesFromData('alice', expenses, [], users);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('bob');
    expect(result[0].amount).toBeCloseTo(25, 5); // positive = owes alice
  });

  test('after full settlement — no balance', () => {
    const expenses = [{
      paidBy: { id: 'alice' },
      splits: [{ userId: 'alice', amount: 25 }, { userId: 'bob', amount: 25 }],
    }];
    const settlements = [{ paidBy: 'bob', paidTo: 'alice', amount: 25 }];
    const result = _calculateBalancesFromData('alice', expenses, settlements, users);
    expect(result).toHaveLength(0); // settled — filtered out by < 0.01 check
  });

  test('partial settlement — remaining balance shown', () => {
    const expenses = [{
      paidBy: { id: 'alice' },
      splits: [{ userId: 'alice', amount: 25 }, { userId: 'bob', amount: 25 }],
    }];
    const settlements = [{ paidBy: 'bob', paidTo: 'alice', amount: 15 }];
    const result = _calculateBalancesFromData('alice', expenses, settlements, users);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBeCloseTo(10, 5);
  });

  test('bob perspective — negative amount means bob owes alice', () => {
    const expenses = [{
      paidBy: { id: 'alice' },
      splits: [{ userId: 'alice', amount: 25 }, { userId: 'bob', amount: 25 }],
    }];
    const result = _calculateBalancesFromData('bob', expenses, [], users);
    expect(result[0].amount).toBeCloseTo(-25, 5); // negative = bob owes
  });

  test('🐛 BUG: payer split included — double-counts if paidBy not excluded', () => {
    // If payer's own split is NOT skipped, balance would be wrong
    // The code skips `if (split.userId === paidById) return;` — correct
    const expenses = [{
      paidBy: { id: 'alice' },
      splits: [
        { userId: 'alice', amount: 25 }, // payer's own split — should be skipped
        { userId: 'bob',   amount: 25 },
      ],
    }];
    const result = _calculateBalancesFromData('alice', expenses, [], users);
    // alice should only see bob owing her 25, not alice owing alice anything
    expect(result.every(r => r.userId !== 'alice')).toBe(true);
    expect(result[0].amount).toBeCloseTo(25, 5);
  });
});
