package com.ajayksingh.evenly.dao;

import com.ajayksingh.evenly.model.User;
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

@RegisterRowMapper(UserDAO.UserRowMapper.class)
public interface UserDAO {

    @SqlQuery("SELECT id, name, email, avatar, phone, created_at FROM users WHERE id = :id")
    Optional<User> findById(@Bind("id") String id);

    @SqlQuery("SELECT id, name, email, avatar, phone, created_at FROM users WHERE email = :email")
    Optional<User> findByEmail(@Bind("email") String email);

    @SqlQuery("SELECT id, name, email, avatar, phone, created_at FROM users WHERE email ILIKE :pattern LIMIT 10")
    List<User> searchByEmail(@Bind("pattern") String pattern);

    @SqlUpdate("INSERT INTO users (id, name, email, avatar, phone, provider, created_at) " +
               "VALUES (:id, :name, :email, :avatar, :phone, 'api', :createdAt) " +
               "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar, phone = EXCLUDED.phone")
    void upsert(@BindBean User user);

    @SqlUpdate("UPDATE users SET name = :name, avatar = :avatar, phone = :phone WHERE id = :id")
    void update(@Bind("id") String id,
                @Bind("name") String name,
                @Bind("avatar") String avatar,
                @Bind("phone") String phone);

    class UserRowMapper implements RowMapper<User> {
        @Override
        public User map(ResultSet rs, StatementContext ctx) throws SQLException {
            User user = new User();
            user.setId(rs.getString("id"));
            user.setName(rs.getString("name"));
            user.setEmail(rs.getString("email"));
            user.setAvatar(rs.getString("avatar"));
            user.setPhone(rs.getString("phone"));
            user.setCreatedAt(rs.getString("created_at"));
            return user;
        }
    }
}
