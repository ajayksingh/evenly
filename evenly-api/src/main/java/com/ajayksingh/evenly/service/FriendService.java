package com.ajayksingh.evenly.service;

import com.ajayksingh.evenly.dao.FriendDAO;
import com.ajayksingh.evenly.dao.UserDAO;
import com.ajayksingh.evenly.model.Friend;
import com.ajayksingh.evenly.model.User;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class FriendService {

    private static final Logger LOG = LoggerFactory.getLogger(FriendService.class);

    private final FriendDAO friendDAO;
    private final UserDAO userDAO;

    public FriendService(FriendDAO friendDAO, UserDAO userDAO) {
        this.friendDAO = friendDAO;
        this.userDAO = userDAO;
    }

    public List<User> getFriends(String userId) {
        List<Friend> friendRows = friendDAO.findByUser(userId);
        List<User> users = new ArrayList<>();

        for (Friend friend : friendRows) {
            // Resolve the other user's ID (not the current user)
            String otherId = userId.equals(friend.getUserId())
                    ? friend.getFriendId()
                    : friend.getUserId();

            userDAO.findById(otherId).ifPresent(users::add);
        }

        return users;
    }

    public User addFriend(String currentUserId, String targetEmail) {
        if (targetEmail == null || targetEmail.isBlank()) {
            throw new WebApplicationException("Email is required", Response.Status.BAD_REQUEST);
        }

        User targetUser = userDAO.findByEmail(targetEmail)
                .orElseThrow(() -> new NotFoundException("No user found with email: " + targetEmail));

        if (currentUserId.equals(targetUser.getId())) {
            throw new WebApplicationException("Cannot add yourself as a friend", Response.Status.BAD_REQUEST);
        }

        Optional<String> existing = friendDAO.findExisting(currentUserId, targetUser.getId());
        if (existing.isPresent()) {
            throw new WebApplicationException("Already friends with this user", Response.Status.CONFLICT);
        }

        Friend friend = new Friend(
                UUID.randomUUID().toString(),
                currentUserId,
                targetUser.getId(),
                Instant.now().toString()
        );
        friendDAO.insert(friend);

        return targetUser;
    }

    public void removeFriend(String currentUserId, String friendId) {
        Optional<String> existing = friendDAO.findExisting(currentUserId, friendId);
        if (existing.isEmpty()) {
            throw new NotFoundException("Friend relationship not found");
        }
        friendDAO.delete(currentUserId, friendId);
    }
}
