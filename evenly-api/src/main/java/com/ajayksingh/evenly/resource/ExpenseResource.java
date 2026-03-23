package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.dao.ExpenseDAO;
import com.ajayksingh.evenly.dto.AddExpenseRequest;
import com.ajayksingh.evenly.model.Expense;
import com.ajayksingh.evenly.service.GroupService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.auth.Auth;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Path("/api/v1/groups/{groupId}/expenses")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ExpenseResource {

    private static final Logger LOG = LoggerFactory.getLogger(ExpenseResource.class);

    private final ExpenseDAO expenseDAO;
    private final GroupService groupService;
    private final ObjectMapper mapper;

    public ExpenseResource(ExpenseDAO expenseDAO, GroupService groupService, ObjectMapper mapper) {
        this.expenseDAO = expenseDAO;
        this.groupService = groupService;
        this.mapper = mapper;
    }

    /**
     * GET /api/v1/groups/{groupId}/expenses
     * List all expenses for a group.
     */
    @GET
    public List<Expense> listExpenses(@Auth EvenlyPrincipal principal,
                                      @PathParam("groupId") String groupId) {
        // Verify group exists (throws 404 if not)
        groupService.getGroup(groupId);
        return expenseDAO.findByGroup(groupId);
    }

    /**
     * POST /api/v1/groups/{groupId}/expenses
     * Add a new expense to a group.
     */
    @POST
    public Response addExpense(@Auth EvenlyPrincipal principal,
                               @PathParam("groupId") String groupId,
                               @NotNull AddExpenseRequest request) {
        // Verify group exists
        groupService.getGroup(groupId);

        String id = UUID.randomUUID().toString();
        String now = Instant.now().toString();
        String currency = request.getCurrency() != null ? request.getCurrency() : "USD";

        String paidByJson = toJson(request.getPaidBy() != null ? request.getPaidBy() : Collections.emptyMap());
        String splitsJson = toJson(request.getSplits() != null ? request.getSplits() : Collections.emptyList());

        expenseDAO.insert(
                id,
                groupId,
                request.getDescription(),
                request.getAmount(),
                currency,
                paidByJson,
                splitsJson,
                now
        );

        // Return the newly created expense by re-fetching
        return expenseDAO.findByGroup(groupId).stream()
                .filter(e -> id.equals(e.getId()))
                .findFirst()
                .map(e -> Response.status(Response.Status.CREATED).entity(e).build())
                .orElse(Response.status(Response.Status.CREATED).build());
    }

    /**
     * DELETE /api/v1/groups/{groupId}/expenses/{expenseId}
     * Delete an expense.
     */
    @DELETE
    @Path("/{expenseId}")
    public Response deleteExpense(@Auth EvenlyPrincipal principal,
                                  @PathParam("groupId") String groupId,
                                  @PathParam("expenseId") String expenseId) {
        expenseDAO.delete(expenseId);
        return Response.noContent().build();
    }

    // --- helper ---

    private String toJson(Object obj) {
        try {
            return mapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            LOG.error("Failed to serialize to JSON", e);
            throw new InternalServerErrorException("JSON serialization failed");
        }
    }
}
