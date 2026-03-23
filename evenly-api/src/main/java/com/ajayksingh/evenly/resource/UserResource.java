package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.dao.UserDAO;
import com.ajayksingh.evenly.model.User;
import io.dropwizard.auth.Auth;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Path("/api/v1/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource {

    private final UserDAO userDAO;

    public UserResource(UserDAO userDAO) {
        this.userDAO = userDAO;
    }

    /**
     * GET /api/v1/users/me
     * Returns the current user's profile.
     */
    @GET
    @Path("/me")
    public User getMe(@Auth EvenlyPrincipal principal) {
        return userDAO.findById(principal.getUserId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.getUserId()));
    }

    /**
     * PUT /api/v1/users/me
     * Upsert user profile — called at login to sync Supabase auth data.
     */
    @PUT
    @Path("/me")
    public User upsertMe(@Auth EvenlyPrincipal principal, @NotNull Map<String, Object> body) {
        User user = new User();
        user.setId(principal.getUserId());
        user.setEmail(principal.getEmail());
        user.setName(body.containsKey("name") ? (String) body.get("name") : null);
        user.setAvatar(body.containsKey("avatar") ? (String) body.get("avatar") : null);
        user.setPhone(body.containsKey("phone") ? (String) body.get("phone") : null);
        user.setCreatedAt(Instant.now().toString());

        userDAO.upsert(user);

        return userDAO.findById(principal.getUserId())
                .orElseThrow(() -> new InternalServerErrorException("User not found after upsert"));
    }

    /**
     * PATCH /api/v1/users/me
     * Update name, avatar, or phone.
     */
    @PATCH
    @Path("/me")
    public User updateMe(@Auth EvenlyPrincipal principal, @NotNull Map<String, Object> body) {
        User existing = userDAO.findById(principal.getUserId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.getUserId()));

        String name = body.containsKey("name") ? (String) body.get("name") : existing.getName();
        String avatar = body.containsKey("avatar") ? (String) body.get("avatar") : existing.getAvatar();
        String phone = body.containsKey("phone") ? (String) body.get("phone") : existing.getPhone();

        userDAO.update(principal.getUserId(), name, avatar, phone);

        return userDAO.findById(principal.getUserId())
                .orElseThrow(() -> new InternalServerErrorException("User not found after update"));
    }

    /**
     * GET /api/v1/users/search?email=
     * Search users by email prefix.
     */
    @GET
    @Path("/search")
    public List<User> searchUsers(@Auth EvenlyPrincipal principal,
                                  @QueryParam("email") String email) {
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Query parameter 'email' is required");
        }
        return userDAO.searchByEmail("%" + email + "%");
    }
}
