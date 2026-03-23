package com.ajayksingh.evenly;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.core.Configuration;
import io.dropwizard.db.DataSourceFactory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public class EvenlyConfiguration extends Configuration {

    @Valid
    @NotNull
    private DataSourceFactory database = new DataSourceFactory();

    /** Populated from the supabase.jwtSecret YAML key via the nested SupabaseConfig setter. */
    private String supabaseJwtSecret;

    @JsonProperty("database")
    public DataSourceFactory getDatabase() {
        return database;
    }

    @JsonProperty("database")
    public void setDatabase(DataSourceFactory database) {
        this.database = database;
    }

    public String getSupabaseJwtSecret() {
        return supabaseJwtSecret;
    }

    // -------------------------------------------------------------------
    // Nested config class to map the "supabase:" block in config.yml
    // -------------------------------------------------------------------
    public static class SupabaseConfig {
        private String jwtSecret;

        @JsonProperty("jwtSecret")
        public String getJwtSecret() {
            return jwtSecret;
        }

        @JsonProperty("jwtSecret")
        public void setJwtSecret(String jwtSecret) {
            this.jwtSecret = jwtSecret;
        }
    }

    @JsonProperty("supabase")
    public void setSupabase(SupabaseConfig supabase) {
        if (supabase != null) {
            this.supabaseJwtSecret = supabase.getJwtSecret();
        }
    }

    @JsonProperty("supabase")
    public SupabaseConfig getSupabase() {
        SupabaseConfig cfg = new SupabaseConfig();
        cfg.setJwtSecret(supabaseJwtSecret);
        return cfg;
    }
}
