package com.ajayksingh.evenly.dao;

import com.ajayksingh.evenly.model.Group;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RegisterRowMapper(GroupDAO.GroupRowMapper.class)
public interface GroupDAO {

    @SqlQuery("SELECT * FROM get_user_groups(:userId)")
    List<Group> findByMember(@Bind("userId") String userId);

    @SqlQuery("SELECT id, name, type, description, created_by, members, created_at, updated_at " +
              "FROM groups WHERE id = :id")
    Optional<Group> findById(@Bind("id") String id);

    @SqlUpdate("INSERT INTO groups (id, name, type, description, created_by, members, created_at, updated_at) " +
               "VALUES (:id, :name, :type, :description, :createdBy, :members::jsonb, :createdAt, :updatedAt)")
    void insert(@Bind("id") String id,
                @Bind("name") String name,
                @Bind("type") String type,
                @Bind("description") String description,
                @Bind("createdBy") String createdBy,
                @Bind("members") String membersJson,
                @Bind("createdAt") String createdAt,
                @Bind("updatedAt") String updatedAt);

    @SqlUpdate("UPDATE groups SET name = :name, description = :description, " +
               "members = :members::jsonb, updated_at = :updatedAt WHERE id = :id")
    void update(@Bind("id") String id,
                @Bind("name") String name,
                @Bind("description") String description,
                @Bind("members") String membersJson,
                @Bind("updatedAt") String updatedAt);

    class GroupRowMapper implements RowMapper<Group> {
        private static final Logger LOG = LoggerFactory.getLogger(GroupRowMapper.class);
        private static final ObjectMapper MAPPER = new ObjectMapper();
        private static final TypeReference<List<Map<String, Object>>> MEMBERS_TYPE =
                new TypeReference<List<Map<String, Object>>>() {};

        @Override
        public Group map(ResultSet rs, StatementContext ctx) throws SQLException {
            Group group = new Group();
            group.setId(rs.getString("id"));
            group.setName(rs.getString("name"));
            group.setType(rs.getString("type"));
            group.setDescription(rs.getString("description"));
            group.setCreatedBy(rs.getString("created_by"));
            group.setCreatedAt(rs.getString("created_at"));
            group.setUpdatedAt(rs.getString("updated_at"));

            String membersJson = rs.getString("members");
            if (membersJson != null && !membersJson.isBlank()) {
                try {
                    group.setMembers(MAPPER.readValue(membersJson, MEMBERS_TYPE));
                } catch (Exception e) {
                    LOG.warn("Failed to parse members JSON for group {}: {}", group.getId(), e.getMessage());
                    group.setMembers(Collections.emptyList());
                }
            } else {
                group.setMembers(Collections.emptyList());
            }

            return group;
        }
    }
}
