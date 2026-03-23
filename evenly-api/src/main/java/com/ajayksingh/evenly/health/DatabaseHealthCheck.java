package com.ajayksingh.evenly.health;

import com.codahale.metrics.health.HealthCheck;
import org.jdbi.v3.core.Jdbi;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DatabaseHealthCheck extends HealthCheck {

    private static final Logger LOG = LoggerFactory.getLogger(DatabaseHealthCheck.class);

    private final Jdbi jdbi;

    public DatabaseHealthCheck(Jdbi jdbi) {
        this.jdbi = jdbi;
    }

    @Override
    protected Result check() {
        try {
            jdbi.withHandle(handle -> handle.createQuery("SELECT 1").mapTo(Integer.class).one());
            return Result.healthy("Database connection OK");
        } catch (Exception e) {
            LOG.error("Database health check failed", e);
            return Result.unhealthy("Database connection failed: " + e.getMessage());
        }
    }
}
