package com.ajayksingh.evenly.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Settlement {

    private String id;

    @JsonProperty("paid_by")
    private String paidBy;

    @JsonProperty("paid_to")
    private String paidTo;

    @JsonProperty("group_id")
    private String groupId;

    private String note;
    private String currency;
    private double amount;

    @JsonProperty("created_at")
    private String createdAt;

    public Settlement() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPaidBy() { return paidBy; }
    public void setPaidBy(String paidBy) { this.paidBy = paidBy; }

    public String getPaidTo() { return paidTo; }
    public void setPaidTo(String paidTo) { this.paidTo = paidTo; }

    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
