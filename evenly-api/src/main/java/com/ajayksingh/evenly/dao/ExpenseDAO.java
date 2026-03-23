package com.ajayksingh.evenly.dao;

import com.ajayksingh.evenly.model.Expense;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@RegisterRowMapper(ExpenseDAO.ExpenseRowMapper.class)
public interface ExpenseDAO {

    @SqlQuery("SELECT id, group_id, description, amount, currency, category, paid_by, splits, created_at, date " +
              "FROM expenses WHERE group_id = :groupId ORDER BY created_at DESC")
    List<Expense> findByGroup(@Bind("groupId") String groupId);

    @SqlQuery("SELECT id, group_id, description, amount, currency, category, paid_by, splits, created_at, date " +
              "FROM expenses WHERE group_id IN (<groupIds>) ORDER BY created_at DESC LIMIT 500")
    List<Expense> findByGroups(@BindList("groupIds") List<String> groupIds);

    @SqlUpdate("INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, splits, created_at) " +
               "VALUES (:id, :groupId, :description, :amount, :currency, :paidBy::jsonb, :splits::jsonb, :createdAt)")
    void insert(@Bind("id") String id,
                @Bind("groupId") String groupId,
                @Bind("description") String description,
                @Bind("amount") double amount,
                @Bind("currency") String currency,
                @Bind("paidBy") String paidByJson,
                @Bind("splits") String splitsJson,
                @Bind("createdAt") String createdAt);

    @SqlUpdate("DELETE FROM expenses WHERE id = :id")
    void delete(@Bind("id") String id);

    class ExpenseRowMapper implements RowMapper<Expense> {
        private static final Logger LOG = LoggerFactory.getLogger(ExpenseRowMapper.class);
        private static final ObjectMapper MAPPER = new ObjectMapper();
        private static final TypeReference<Map<String, Object>> MAP_TYPE =
                new TypeReference<Map<String, Object>>() {};
        private static final TypeReference<List<Map<String, Object>>> LIST_MAP_TYPE =
                new TypeReference<List<Map<String, Object>>>() {};

        @Override
        public Expense map(ResultSet rs, StatementContext ctx) throws SQLException {
            Expense expense = new Expense();
            expense.setId(rs.getString("id"));
            expense.setGroupId(rs.getString("group_id"));
            expense.setDescription(rs.getString("description"));
            expense.setAmount(rs.getDouble("amount"));
            expense.setCurrency(rs.getString("currency"));

            // category column may not exist in all schemas
            try {
                expense.setCategory(rs.getString("category"));
            } catch (SQLException e) {
                // column not present, ignore
            }

            // date column may not exist in all schemas
            try {
                expense.setDate(rs.getString("date"));
            } catch (SQLException e) {
                // column not present, ignore
            }

            expense.setCreatedAt(rs.getString("created_at"));

            String paidByJson = rs.getString("paid_by");
            if (paidByJson != null && !paidByJson.isBlank()) {
                try {
                    expense.setPaidBy(MAPPER.readValue(paidByJson, MAP_TYPE));
                } catch (Exception e) {
                    LOG.warn("Failed to parse paid_by JSON for expense {}: {}", expense.getId(), e.getMessage());
                }
            }

            String splitsJson = rs.getString("splits");
            if (splitsJson != null && !splitsJson.isBlank()) {
                try {
                    expense.setSplits(MAPPER.readValue(splitsJson, LIST_MAP_TYPE));
                } catch (Exception e) {
                    LOG.warn("Failed to parse splits JSON for expense {}: {}", expense.getId(), e.getMessage());
                    expense.setSplits(Collections.emptyList());
                }
            } else {
                expense.setSplits(Collections.emptyList());
            }

            return expense;
        }
    }
}
