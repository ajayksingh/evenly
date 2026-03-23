package com.ajayksingh.evenly.dto;

import java.util.List;
import java.util.Map;

public class UpdateGroupRequest {

    private String name;
    private String description;
    private List<Map<String, Object>> members;

    public UpdateGroupRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<Map<String, Object>> getMembers() { return members; }
    public void setMembers(List<Map<String, Object>> members) { this.members = members; }
}
