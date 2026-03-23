package com.ajayksingh.evenly.service;

import com.ajayksingh.evenly.model.Balance;
import com.ajayksingh.evenly.model.Expense;
import com.ajayksingh.evenly.model.Settlement;
import com.ajayksingh.evenly.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BalanceService {

    private static final Logger LOG = LoggerFactory.getLogger(BalanceService.class);

    /**
     * Calculate balances for all members of a group.
     * Positive amount = user is owed money; negative = user owes money.
     *
     * @param groupId     the group ID (for logging)
     * @param members     list of member maps (must contain at least "id", "name", "email", "avatar")
     * @param expenses    all expenses for the group
     * @param settlements all settlements for the group
     * @return list of Balance objects, one per member
     */
    public List<Balance> calculateGroupBalances(
            String groupId,
            List<Map<String, Object>> members,
            List<Expense> expenses,
            List<Settlement> settlements) {

        // Build a balance map keyed by userId -> running net balance
        Map<String, Double> balanceMap = new HashMap<>();

        // Seed every member with 0.0 so even members with no transactions appear
        if (members != null) {
            for (Map<String, Object> member : members) {
                String memberId = toStr(member.get("id"));
                if (memberId != null) {
                    balanceMap.put(memberId, 0.0);
                }
            }
        }

        // Apply expenses
        if (expenses != null) {
            for (Expense expense : expenses) {
                // The payer gets credited the full amount
                if (expense.getPaidBy() != null) {
                    String payerId = toStr(expense.getPaidBy().get("id"));
                    if (payerId != null) {
                        balanceMap.merge(payerId, expense.getAmount(), Double::sum);
                    }
                }

                // Each person in splits owes their share
                if (expense.getSplits() != null) {
                    for (Map<String, Object> split : expense.getSplits()) {
                        String splitUserId = toStr(split.get("userId"));
                        if (splitUserId == null) {
                            splitUserId = toStr(split.get("user_id"));
                        }
                        double splitAmount = toDouble(split.get("amount"));
                        if (splitUserId != null) {
                            balanceMap.merge(splitUserId, -splitAmount, Double::sum);
                        }
                    }
                }
            }
        }

        // Apply settlements
        if (settlements != null) {
            for (Settlement settlement : settlements) {
                // paidBy reduces their debt (positive credit to them)
                if (settlement.getPaidBy() != null) {
                    balanceMap.merge(settlement.getPaidBy(), settlement.getAmount(), Double::sum);
                }
                // paidTo had their credit reduced
                if (settlement.getPaidTo() != null) {
                    balanceMap.merge(settlement.getPaidTo(), -settlement.getAmount(), Double::sum);
                }
            }
        }

        // Build a lookup map for member info
        Map<String, Map<String, Object>> memberInfo = new HashMap<>();
        if (members != null) {
            for (Map<String, Object> member : members) {
                String memberId = toStr(member.get("id"));
                if (memberId != null) {
                    memberInfo.put(memberId, member);
                }
            }
        }

        // Convert to Balance objects
        List<Balance> balances = new ArrayList<>();
        for (Map.Entry<String, Double> entry : balanceMap.entrySet()) {
            String userId = entry.getKey();
            double amount = entry.getValue();

            Map<String, Object> info = memberInfo.get(userId);
            String name = info != null ? toStr(info.get("name")) : null;
            String email = info != null ? toStr(info.get("email")) : null;
            String avatar = info != null ? toStr(info.get("avatar")) : null;

            balances.add(new Balance(userId, name, email, avatar, amount));
        }

        return balances;
    }

    /**
     * Calculate net balances for a user across all their groups.
     * Aggregates expenses and settlements by other user to produce per-person balances.
     *
     * @param userId      the current user's ID
     * @param expenses    all expenses across the user's groups
     * @param settlements all settlements involving the user
     * @param otherUsers  list of other users to build the balance map for
     * @return list of Balance objects representing what the current user owes / is owed
     */
    public List<Balance> calculateUserBalances(
            String userId,
            List<Expense> expenses,
            List<Settlement> settlements,
            List<User> otherUsers) {

        // Net balance map: otherUserId -> amount (positive = other owes current user)
        Map<String, Double> balanceMap = new HashMap<>();

        if (expenses != null) {
            for (Expense expense : expenses) {
                if (expense.getPaidBy() == null || expense.getSplits() == null) continue;

                String payerId = toStr(expense.getPaidBy().get("id"));

                if (userId.equals(payerId)) {
                    // Current user paid — each other split participant owes them
                    for (Map<String, Object> split : expense.getSplits()) {
                        String splitUserId = toStr(split.get("userId"));
                        if (splitUserId == null) splitUserId = toStr(split.get("user_id"));
                        if (splitUserId == null || splitUserId.equals(userId)) continue;

                        double splitAmount = toDouble(split.get("amount"));
                        balanceMap.merge(splitUserId, splitAmount, Double::sum);
                    }
                } else {
                    // Someone else paid — check if current user is in splits
                    for (Map<String, Object> split : expense.getSplits()) {
                        String splitUserId = toStr(split.get("userId"));
                        if (splitUserId == null) splitUserId = toStr(split.get("user_id"));
                        if (!userId.equals(splitUserId)) continue;

                        double splitAmount = toDouble(split.get("amount"));
                        // Current user owes payerId
                        balanceMap.merge(payerId, -splitAmount, Double::sum);
                    }
                }
            }
        }

        if (settlements != null) {
            for (Settlement settlement : settlements) {
                if (userId.equals(settlement.getPaidBy())) {
                    // Current user settled with paidTo — reduces what paidTo owes us (or reduces our debt)
                    balanceMap.merge(settlement.getPaidTo(), settlement.getAmount(), Double::sum);
                } else if (userId.equals(settlement.getPaidTo())) {
                    // Someone settled with us — reduces what we think they owe us
                    balanceMap.merge(settlement.getPaidBy(), -settlement.getAmount(), Double::sum);
                }
            }
        }

        // Build a lookup for other users
        Map<String, User> userLookup = new HashMap<>();
        if (otherUsers != null) {
            for (User u : otherUsers) {
                userLookup.put(u.getId(), u);
            }
        }

        List<Balance> balances = new ArrayList<>();
        for (Map.Entry<String, Double> entry : balanceMap.entrySet()) {
            String otherId = entry.getKey();
            double amount = entry.getValue();

            User other = userLookup.get(otherId);
            String name = other != null ? other.getName() : null;
            String email = other != null ? other.getEmail() : null;
            String avatar = other != null ? other.getAvatar() : null;

            balances.add(new Balance(otherId, name, email, avatar, amount));
        }

        return balances;
    }

    // --- helpers ---

    private String toStr(Object o) {
        return o instanceof String s ? s : (o != null ? o.toString() : null);
    }

    private double toDouble(Object o) {
        if (o == null) return 0.0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(o.toString());
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
