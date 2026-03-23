package com.ajayksingh.evenly.resource;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import io.dropwizard.auth.Auth;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.jdbi.v3.core.Jdbi;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

@Path("/api/v1/activity")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ActivityResource {

    private static final Logger LOG = LoggerFactory.getLogger(ActivityResource.class);

    // Raw SQL to fetch recent activity for the user: expenses + settlements across their groups.
    // Assumes an `activity` view or table; falls back to UNION of expenses/settlements.
    private static final String ACTIVITY_SQL =
            "SELECT 'expense' AS type, e.id, e.description, e.amount, e.currency, " +
            "       e.created_at, e.group_id, NULL AS note, e.paid_by::text, NULL AS paid_to " +
            "FROM expenses e " +
            "WHERE e.group_id IN ( " +
            "  SELECT g.id FROM groups g WHERE g.members::text LIKE '%' || :userId || '%' " +
            ") " +
            "UNION ALL " +
            "SELECT 'settlement' AS type, s.id, NULL AS description, s.amount, s.currency, " +
            "       s.created_at, s.group_id, s.note, s.paid_by, s.paid_to " +
            "FROM settlements s " +
            "WHERE s.paid_by = :userId OR s.paid_to = :userId " +
            "ORDER BY created_at DESC " +
            "LIMIT 100";

    private final Jdbi jdbi;

    public ActivityResource(Jdbi jdbi) {
        this.jdbi = jdbi;
    }

    /**
     * GET /api/v1/activity
     * Returns recent activity (expenses and settlements) for the current user.
     */
    @GET
    public List<Map<String, Object>> getActivity(@Auth EvenlyPrincipal principal) {
        return jdbi.withHandle(handle ->
                handle.createQuery(ACTIVITY_SQL)
                        .bind("userId", principal.getUserId())
                        .mapToMap()
                        .list()
        );
    }
}
