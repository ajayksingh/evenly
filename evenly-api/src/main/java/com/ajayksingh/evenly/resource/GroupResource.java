package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.dao.ExpenseDAO;
import com.ajayksingh.evenly.dao.SettlementDAO;
import com.ajayksingh.evenly.dao.UserDAO;
import com.ajayksingh.evenly.dto.AddMemberRequest;
import com.ajayksingh.evenly.dto.CreateGroupRequest;
import com.ajayksingh.evenly.dto.UpdateGroupRequest;
import com.ajayksingh.evenly.model.Balance;
import com.ajayksingh.evenly.model.Expense;
import com.ajayksingh.evenly.model.Group;
import com.ajayksingh.evenly.model.Settlement;
import com.ajayksingh.evenly.model.User;
import com.ajayksingh.evenly.service.BalanceService;
import com.ajayksingh.evenly.service.GroupService;
import io.dropwizard.auth.Auth;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/api/v1/groups")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GroupResource {

    private final GroupService groupService;
    private final UserDAO userDAO;
    private final ExpenseDAO expenseDAO;
    private final SettlementDAO settlementDAO;
    private final BalanceService balanceService;

    public GroupResource(GroupService groupService,
                         UserDAO userDAO,
                         ExpenseDAO expenseDAO,
                         SettlementDAO settlementDAO,
                         BalanceService balanceService) {
        this.groupService = groupService;
        this.userDAO = userDAO;
        this.expenseDAO = expenseDAO;
        this.settlementDAO = settlementDAO;
        this.balanceService = balanceService;
    }

    /**
     * GET /api/v1/groups
     * List all groups the current user is a member of.
     */
    @GET
    public List<Group> listGroups(@Auth EvenlyPrincipal principal) {
        return groupService.getGroupsForUser(principal.getUserId());
    }

    /**
     * POST /api/v1/groups
     * Create a new group.
     */
    @POST
    public Response createGroup(@Auth EvenlyPrincipal principal,
                                @NotNull @Valid CreateGroupRequest request) {
        Group group = groupService.createGroup(principal.getUserId(), request);
        return Response.status(Response.Status.CREATED).entity(group).build();
    }

    /**
     * GET /api/v1/groups/{id}
     * Get a single group by ID.
     */
    @GET
    @Path("/{id}")
    public Group getGroup(@Auth EvenlyPrincipal principal,
                          @PathParam("id") String id) {
        return groupService.getGroup(id);
    }

    /**
     * PATCH /api/v1/groups/{id}
     * Update group name, description, or members.
     */
    @PATCH
    @Path("/{id}")
    public Group updateGroup(@Auth EvenlyPrincipal principal,
                             @PathParam("id") String id,
                             @NotNull UpdateGroupRequest request) {
        return groupService.updateGroup(id, request);
    }

    /**
     * POST /api/v1/groups/{id}/members
     * Add a member to a group by email.
     */
    @POST
    @Path("/{id}/members")
    public Group addMember(@Auth EvenlyPrincipal principal,
                           @PathParam("id") String id,
                           @NotNull AddMemberRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new BadRequestException("Email is required");
        }

        User newMember = userDAO.findByEmail(request.getEmail())
                .orElseThrow(() -> new NotFoundException("No user found with email: " + request.getEmail()));

        return groupService.addMember(id, newMember);
    }

    /**
     * GET /api/v1/groups/{id}/balances
     * Calculate and return balances for all members of a group.
     */
    @GET
    @Path("/{id}/balances")
    public List<Balance> getGroupBalances(@Auth EvenlyPrincipal principal,
                                          @PathParam("id") String id) {
        Group group = groupService.getGroup(id);
        List<Expense> expenses = expenseDAO.findByGroup(id);
        List<Settlement> settlements = settlementDAO.findByGroup(id);

        return balanceService.calculateGroupBalances(id, group.getMembers(), expenses, settlements);
    }
}
