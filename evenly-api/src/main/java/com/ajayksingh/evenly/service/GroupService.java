package com.ajayksingh.evenly.service;

import com.ajayksingh.evenly.dao.GroupDAO;
import com.ajayksingh.evenly.dto.CreateGroupRequest;
import com.ajayksingh.evenly.dto.UpdateGroupRequest;
import com.ajayksingh.evenly.model.Group;
import com.ajayksingh.evenly.model.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class GroupService {

    private static final Logger LOG = LoggerFactory.getLogger(GroupService.class);

    private final GroupDAO groupDAO;
    private final ObjectMapper mapper;

    public GroupService(GroupDAO groupDAO, ObjectMapper mapper) {
        this.groupDAO = groupDAO;
        this.mapper = mapper;
    }

    public List<Group> getGroupsForUser(String userId) {
        return groupDAO.findByMember(userId);
    }

    public Group createGroup(String creatorId, CreateGroupRequest req) {
        String id = UUID.randomUUID().toString();
        String now = Instant.now().toString();

        List<Map<String, Object>> members = req.getMembers() != null
                ? new ArrayList<>(req.getMembers())
                : new ArrayList<>();

        // Ensure creator is in the members list
        boolean creatorPresent = members.stream()
                .anyMatch(m -> creatorId.equals(m.get("id")));
        if (!creatorPresent) {
            Map<String, Object> creatorEntry = new HashMap<>();
            creatorEntry.put("id", creatorId);
            creatorEntry.put("role", "admin");
            members.add(0, creatorEntry);
        }

        groupDAO.insert(
                id,
                req.getName(),
                req.getType() != null ? req.getType() : "other",
                req.getDescription(),
                creatorId,
                toJson(members),
                now,
                now
        );

        return groupDAO.findById(id)
                .orElseThrow(() -> new WebApplicationException("Group not found after insert", Response.Status.INTERNAL_SERVER_ERROR));
    }

    public Group getGroup(String groupId) {
        return groupDAO.findById(groupId)
                .orElseThrow(() -> new NotFoundException("Group not found: " + groupId));
    }

    public Group updateGroup(String groupId, UpdateGroupRequest req) {
        Group existing = getGroup(groupId);

        String name = req.getName() != null ? req.getName() : existing.getName();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        List<Map<String, Object>> members = req.getMembers() != null ? req.getMembers() : existing.getMembers();
        String now = Instant.now().toString();

        groupDAO.update(groupId, name, description, toJson(members), now);

        return groupDAO.findById(groupId)
                .orElseThrow(() -> new NotFoundException("Group not found after update: " + groupId));
    }

    public Group addMember(String groupId, User newMember) {
        Group group = getGroup(groupId);
        List<Map<String, Object>> members = group.getMembers() != null
                ? new ArrayList<>(group.getMembers())
                : new ArrayList<>();

        // Check for duplicate
        boolean alreadyMember = members.stream()
                .anyMatch(m -> newMember.getId().equals(m.get("id")));
        if (alreadyMember) {
            throw new WebApplicationException("User is already a member of this group", Response.Status.CONFLICT);
        }

        Map<String, Object> memberEntry = new HashMap<>();
        memberEntry.put("id", newMember.getId());
        memberEntry.put("name", newMember.getName());
        memberEntry.put("email", newMember.getEmail());
        memberEntry.put("avatar", newMember.getAvatar());
        memberEntry.put("role", "member");
        members.add(memberEntry);

        String now = Instant.now().toString();
        groupDAO.update(groupId, group.getName(), group.getDescription(), toJson(members), now);

        return groupDAO.findById(groupId)
                .orElseThrow(() -> new NotFoundException("Group not found after member add: " + groupId));
    }

    private String toJson(Object obj) {
        try {
            return mapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            LOG.error("Failed to serialize object to JSON", e);
            throw new WebApplicationException("JSON serialization failed", Response.Status.INTERNAL_SERVER_ERROR);
        }
    }
}
