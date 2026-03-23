package com.ajayksingh.evenly.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class User {

    private String id;
    private String name;
    private String email;
    private String avatar;
    private String phone;

    @JsonProperty("created_at")
    private String createdAt;

    public User() {}

    public User(String id, String name, String email, String avatar, String phone, String createdAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.avatar = avatar;
        this.phone = phone;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
