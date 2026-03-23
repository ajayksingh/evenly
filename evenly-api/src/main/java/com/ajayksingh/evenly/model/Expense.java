package com.ajayksingh.evenly.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public class Expense {

    private String id;

    @JsonProperty("group_id")
    private String groupId;

    private String description;
    private double amount;
    private String currency;
    private String category;

    @JsonProperty("paid_by")
    private Map<String, Object> paidBy;

    private List<Map<String, Object>> splits;

    @JsonProperty("created_at")
    private String createdAt;

    private String date;

    public Expense() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public Map<String, Object> getPaidBy() { return paidBy; }
    public void setPaidBy(Map<String, Object> paidBy) { this.paidBy = paidBy; }

    public List<Map<String, Object>> getSplits() { return splits; }
    public void setSplits(List<Map<String, Object>> splits) { this.splits = splits; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
}
