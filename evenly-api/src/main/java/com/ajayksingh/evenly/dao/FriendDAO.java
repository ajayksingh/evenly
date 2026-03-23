package com.ajayksingh.evenly.dao;

import com.ajayksingh.evenly.model.Friend;
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
import java.util.Optional;

@RegisterRowMapper(FriendDAO.FriendRowMapper.class)
public interface FriendDAO {

    @SqlQuery("SELECT id, user_id, friend_id, created_at FROM friends " +
              "WHERE user_id = :userId OR friend_id = :userId")
    List<Friend> findByUser(@Bind("userId") String userId);

    @SqlQuery("SELECT id FROM friends " +
              "WHERE (user_id = :a AND friend_id = :b) OR (user_id = :b AND friend_id = :a) LIMIT 1")
    Optional<String> findExisting(@Bind("a") String a, @Bind("b") String b);

    @SqlUpdate("INSERT INTO friends (id, user_id, friend_id, created_at) " +
               "VALUES (:id, :userId, :friendId, :createdAt)")
    void insert(@BindBean Friend friend);

    @SqlUpdate("DELETE FROM friends WHERE (user_id = :a AND friend_id = :b) OR (user_id = :b AND friend_id = :a)")
    void delete(@Bind("a") String a, @Bind("b") String b);

    class FriendRowMapper implements RowMapper<Friend> {
        @Override
        public Friend map(ResultSet rs, StatementContext ctx) throws SQLException {
            Friend friend = new Friend();
            friend.setId(rs.getString("id"));
            friend.setUserId(rs.getString("user_id"));
            friend.setFriendId(rs.getString("friend_id"));
            friend.setCreatedAt(rs.getString("created_at"));
            return friend;
        }
    }
}
