package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.dto.AddFriendRequest;
import com.ajayksingh.evenly.model.User;
import com.ajayksingh.evenly.service.FriendService;
import io.dropwizard.auth.Auth;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/api/v1/friends")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FriendResource {

    private final FriendService friendService;

    public FriendResource(FriendService friendService) {
        this.friendService = friendService;
    }

    /**
     * GET /api/v1/friends
     * List the current user's friends.
     */
    @GET
    public List<User> listFriends(@Auth EvenlyPrincipal principal) {
        return friendService.getFriends(principal.getUserId());
    }

    /**
     * POST /api/v1/friends
     * Add a friend by email.
     */
    @POST
    public Response addFriend(@Auth EvenlyPrincipal principal,
                              @NotNull AddFriendRequest request) {
        User added = friendService.addFriend(principal.getUserId(), request.getEmail());
        return Response.status(Response.Status.CREATED).entity(added).build();
    }

    /**
     * DELETE /api/v1/friends/{friendId}
     * Remove a friend by their user ID.
     */
    @DELETE
    @Path("/{friendId}")
    public Response removeFriend(@Auth EvenlyPrincipal principal,
                                 @PathParam("friendId") String friendId) {
        friendService.removeFriend(principal.getUserId(), friendId);
        return Response.noContent().build();
    }
}
