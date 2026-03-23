package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.dao.SettlementDAO;
import com.ajayksingh.evenly.dto.RecordSettlementRequest;
import com.ajayksingh.evenly.model.Settlement;
import com.ajayksingh.evenly.service.GroupService;
import io.dropwizard.auth.Auth;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.UUID;

@Path("/api/v1/groups/{groupId}/settlements")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SettlementResource {

    private final SettlementDAO settlementDAO;
    private final GroupService groupService;

    public SettlementResource(SettlementDAO settlementDAO, GroupService groupService) {
        this.settlementDAO = settlementDAO;
        this.groupService = groupService;
    }

    /**
     * POST /api/v1/groups/{groupId}/settlements
     * Record a settlement payment within a group.
     */
    @POST
    public Response recordSettlement(@Auth EvenlyPrincipal principal,
                                     @PathParam("groupId") String groupId,
                                     @NotNull RecordSettlementRequest request) {
        // Verify group exists
        groupService.getGroup(groupId);

        Settlement settlement = buildSettlement(principal.getUserId(), groupId, request);
        settlementDAO.insert(settlement);

        return Response.status(Response.Status.CREATED).entity(settlement).build();
    }

    // --- helper ---

    static Settlement buildSettlement(String payerId, String groupId, RecordSettlementRequest request) {
        Settlement settlement = new Settlement();
        settlement.setId(UUID.randomUUID().toString());
        settlement.setPaidBy(payerId);
        settlement.setPaidTo(request.getPaidTo());
        settlement.setAmount(request.getAmount());
        settlement.setCurrency(request.getCurrency() != null ? request.getCurrency() : "USD");
        settlement.setGroupId(groupId);
        settlement.setNote(request.getNote());
        settlement.setCreatedAt(Instant.now().toString());
        return settlement;
    }
}
