package com.ajayksingh.evenly.model;

public class Balance {

    private String userId;
    private String name;
    private String email;
    private String avatar;
    private double amount;

    public Balance() {}

    public Balance(String userId, String name, String email, String avatar, double amount) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.avatar = avatar;
        this.amount = amount;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }
}
