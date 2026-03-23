package com.ajayksingh.evenly.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Friend {

    private String id;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("friend_id")
    private String friendId;

    @JsonProperty("created_at")
    private String createdAt;

    public Friend() {}

    public Friend(String id, String userId, String friendId, String createdAt) {
        this.id = id;
        this.userId = userId;
        this.friendId = friendId;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getFriendId() { return friendId; }
    public void setFriendId(String friendId) { this.friendId = friendId; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
