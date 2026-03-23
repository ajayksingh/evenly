package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.dao.ExpenseDAO;
import com.ajayksingh.evenly.model.Expense;
import com.ajayksingh.evenly.model.Group;
import com.ajayksingh.evenly.service.GroupService;
import io.dropwizard.auth.Auth;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Handles GET /api/v1/expenses — returns all expenses across all of the user's groups.
 * This lives at a separate path from ExpenseResource (which is nested under /groups/{groupId}).
 */
@Path("/api/v1/expenses")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AllExpensesResource {

    private final ExpenseDAO expenseDAO;
    private final GroupService groupService;

    public AllExpensesResource(ExpenseDAO expenseDAO, GroupService groupService) {
        this.expenseDAO = expenseDAO;
        this.groupService = groupService;
    }

    /**
     * GET /api/v1/expenses
     * Returns all expenses across all groups the current user belongs to.
     */
    @GET
    public List<Expense> getAllExpenses(@Auth EvenlyPrincipal principal) {
        List<Group> groups = groupService.getGroupsForUser(principal.getUserId());

        if (groups.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> groupIds = groups.stream()
                .map(Group::getId)
                .collect(Collectors.toList());

        return expenseDAO.findByGroups(groupIds);
    }
}
