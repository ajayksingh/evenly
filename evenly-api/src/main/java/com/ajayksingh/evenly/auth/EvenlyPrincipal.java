package com.ajayksingh.evenly.auth;

import java.security.Principal;

public class EvenlyPrincipal implements Principal {

    private final String userId;
    private final String email;

    public EvenlyPrincipal(String userId, String email) {
        this.userId = userId;
        this.email = email;
    }

    public String getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    @Override
    public String getName() {
        return userId;
    }
}
