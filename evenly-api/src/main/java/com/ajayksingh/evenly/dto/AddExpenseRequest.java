package com.ajayksingh.evenly.dto;

import java.util.List;
import java.util.Map;

public class AddExpenseRequest {

    private String description;
    private String currency;
    private String category;
    private double amount;
    private Map<String, Object> paidBy;
    private List<Map<String, Object>> splits;

    public AddExpenseRequest() {}

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public Map<String, Object> getPaidBy() { return paidBy; }
    public void setPaidBy(Map<String, Object> paidBy) { this.paidBy = paidBy; }

    public List<Map<String, Object>> getSplits() { return splits; }
    public void setSplits(List<Map<String, Object>> splits) { this.splits = splits; }
}
