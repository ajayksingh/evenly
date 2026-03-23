package com.ajayksingh.evenly.dto;

public class RecordSettlementRequest {

    private String paidTo;
    private String groupId;
    private String note;
    private String currency;
    private double amount;

    public RecordSettlementRequest() {}

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
}
