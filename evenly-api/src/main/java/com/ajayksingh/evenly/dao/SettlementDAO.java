package com.ajayksingh.evenly.dao;

import com.ajayksingh.evenly.model.Settlement;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@RegisterRowMapper(SettlementDAO.SettlementRowMapper.class)
public interface SettlementDAO {

    @SqlQuery("SELECT id, paid_by, paid_to, amount, currency, group_id, note, created_at " +
              "FROM settlements WHERE group_id = :groupId ORDER BY created_at DESC")
    List<Settlement> findByGroup(@Bind("groupId") String groupId);

    @SqlQuery("SELECT id, paid_by, paid_to, amount, currency, group_id, note, created_at " +
              "FROM settlements WHERE paid_by = :userId OR paid_to = :userId ORDER BY created_at DESC")
    List<Settlement> findByUser(@Bind("userId") String userId);

    @SqlUpdate("INSERT INTO settlements (id, paid_by, paid_to, amount, currency, group_id, note, created_at) " +
               "VALUES (:id, :paidBy, :paidTo, :amount, :currency, :groupId, :note, :createdAt)")
    void insert(@BindBean Settlement settlement);

    class SettlementRowMapper implements RowMapper<Settlement> {
        @Override
        public Settlement map(ResultSet rs, StatementContext ctx) throws SQLException {
            Settlement settlement = new Settlement();
            settlement.setId(rs.getString("id"));
            settlement.setPaidBy(rs.getString("paid_by"));
            settlement.setPaidTo(rs.getString("paid_to"));
            settlement.setAmount(rs.getDouble("amount"));
            settlement.setCurrency(rs.getString("currency"));
            settlement.setGroupId(rs.getString("group_id"));
            settlement.setNote(rs.getString("note"));
            settlement.setCreatedAt(rs.getString("created_at"));
            return settlement;
        }
    }
}
