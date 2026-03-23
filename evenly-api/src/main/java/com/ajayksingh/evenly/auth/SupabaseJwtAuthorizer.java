package com.ajayksingh.evenly.auth;

import io.dropwizard.auth.Authorizer;
import jakarta.ws.rs.container.ContainerRequestContext;

import jakarta.annotation.Nullable;

public class SupabaseJwtAuthorizer implements Authorizer<EvenlyPrincipal> {

    @Override
    public boolean authorize(EvenlyPrincipal principal, String role, @Nullable ContainerRequestContext requestContext) {
        // No role-based auth needed — any authenticated user is authorized
        return true;
    }
}
