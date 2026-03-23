package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.dao.SettlementDAO;
import com.ajayksingh.evenly.dto.RecordSettlementRequest;
import com.ajayksingh.evenly.model.Settlement;
import io.dropwizard.auth.Auth;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Handles POST /api/v1/settlements — non-group (direct) settlement between two users.
 */
@Path("/api/v1/settlements")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DirectSettlementResource {

    private final SettlementDAO settlementDAO;

    public DirectSettlementResource(SettlementDAO settlementDAO) {
        this.settlementDAO = settlementDAO;
    }

    /**
     * POST /api/v1/settlements
     * Record a direct (non-group) settlement payment.
     */
    @POST
    public Response recordDirectSettlement(@Auth EvenlyPrincipal principal,
                                           @NotNull RecordSettlementRequest request) {
        // groupId may be null for direct settlements
        Settlement settlement = SettlementResource.buildSettlement(
                principal.getUserId(),
                request.getGroupId(),
                request
        );
        settlementDAO.insert(settlement);
        return Response.status(Response.Status.CREATED).entity(settlement).build();
    }
}
