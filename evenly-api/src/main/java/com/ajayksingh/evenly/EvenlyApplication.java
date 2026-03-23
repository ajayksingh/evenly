package com.ajayksingh.evenly;

import com.ajayksingh.evenly.auth.EvenlyPrincipal;
import com.ajayksingh.evenly.auth.SupabaseJwtAuthenticator;
import com.ajayksingh.evenly.auth.SupabaseJwtAuthorizer;
import com.ajayksingh.evenly.dao.ExpenseDAO;
import com.ajayksingh.evenly.dao.FriendDAO;
import com.ajayksingh.evenly.dao.GroupDAO;
import com.ajayksingh.evenly.dao.SettlementDAO;
import com.ajayksingh.evenly.dao.UserDAO;
import com.ajayksingh.evenly.health.DatabaseHealthCheck;
import com.ajayksingh.evenly.resource.ActivityResource;
import com.ajayksingh.evenly.resource.AllExpensesResource;
import com.ajayksingh.evenly.resource.DirectSettlementResource;
import com.ajayksingh.evenly.resource.ExpenseResource;
import com.ajayksingh.evenly.resource.FriendResource;
import com.ajayksingh.evenly.resource.GroupResource;
import com.ajayksingh.evenly.resource.SettlementResource;
import com.ajayksingh.evenly.resource.UserResource;
import com.ajayksingh.evenly.service.BalanceService;
import com.ajayksingh.evenly.service.FriendService;
import com.ajayksingh.evenly.service.GroupService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.auth.AuthDynamicFeature;
import io.dropwizard.auth.AuthValueFactoryProvider;
import io.dropwizard.auth.oauth.OAuthCredentialAuthFilter;
import io.dropwizard.core.Application;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.jdbi3.JdbiFactory;
import org.eclipse.jetty.servlets.CrossOriginFilter;
import org.glassfish.jersey.server.filter.RolesAllowedDynamicFeature;
import org.jdbi.v3.core.Jdbi;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterRegistration;
import java.util.EnumSet;

public class EvenlyApplication extends Application<EvenlyConfiguration> {

    private static final Logger LOG = LoggerFactory.getLogger(EvenlyApplication.class);

    public static void main(String[] args) throws Exception {
        new EvenlyApplication().run(args);
    }

    @Override
    public String getName() {
        return "evenly-api";
    }

    @Override
    public void initialize(Bootstrap<EvenlyConfiguration> bootstrap) {
        // No bundles needed — JdbiFactory is used directly in run()
    }

    @Override
    public void run(EvenlyConfiguration configuration, Environment environment) throws Exception {
        LOG.info("Starting Evenly API...");

        // ---- JDBI setup ----
        final JdbiFactory factory = new JdbiFactory();
        final Jdbi jdbi = factory.build(environment, configuration.getDatabase(), "postgresql");

        // ---- DAOs ----
        final UserDAO userDAO = jdbi.onDemand(UserDAO.class);
        final GroupDAO groupDAO = jdbi.onDemand(GroupDAO.class);
        final ExpenseDAO expenseDAO = jdbi.onDemand(ExpenseDAO.class);
        final FriendDAO friendDAO = jdbi.onDemand(FriendDAO.class);
        final SettlementDAO settlementDAO = jdbi.onDemand(SettlementDAO.class);

        // ---- Services ----
        final ObjectMapper objectMapper = environment.getObjectMapper();
        final GroupService groupService = new GroupService(groupDAO, objectMapper);
        final FriendService friendService = new FriendService(friendDAO, userDAO);
        final BalanceService balanceService = new BalanceService();

        // ---- Auth ----
        final SupabaseJwtAuthenticator authenticator =
                new SupabaseJwtAuthenticator(configuration.getSupabaseJwtSecret());
        final SupabaseJwtAuthorizer authorizer = new SupabaseJwtAuthorizer();

        environment.jersey().register(new AuthDynamicFeature(
                new OAuthCredentialAuthFilter.Builder<EvenlyPrincipal>()
                        .setAuthenticator(authenticator)
                        .setAuthorizer(authorizer)
                        .setPrefix("Bearer")
                        .buildAuthFilter()
        ));
        environment.jersey().register(RolesAllowedDynamicFeature.class);
        environment.jersey().register(new AuthValueFactoryProvider.Binder<>(EvenlyPrincipal.class));

        // ---- Resources ----
        environment.jersey().register(new UserResource(userDAO));
        environment.jersey().register(new GroupResource(groupService, userDAO, expenseDAO, settlementDAO, balanceService));
        environment.jersey().register(new ExpenseResource(expenseDAO, groupService, objectMapper));
        environment.jersey().register(new AllExpensesResource(expenseDAO, groupService));
        environment.jersey().register(new FriendResource(friendService));
        environment.jersey().register(new SettlementResource(settlementDAO, groupService));
        environment.jersey().register(new DirectSettlementResource(settlementDAO));
        environment.jersey().register(new ActivityResource(jdbi));

        // ---- Health Checks ----
        environment.healthChecks().register("database", new DatabaseHealthCheck(jdbi));

        // ---- CORS ----
        configureCors(environment);

        LOG.info("Evenly API started successfully.");
    }

    private void configureCors(Environment environment) {
        final FilterRegistration.Dynamic cors =
                environment.servlets().addFilter("CORS", CrossOriginFilter.class);

        // Allow requests from any origin (tighten in production)
        cors.setInitParameter(CrossOriginFilter.ALLOWED_ORIGINS_PARAM, "*");
        cors.setInitParameter(CrossOriginFilter.ALLOWED_HEADERS_PARAM,
                "X-Requested-With,Content-Type,Accept,Origin,Authorization");
        cors.setInitParameter(CrossOriginFilter.ALLOWED_METHODS_PARAM,
                "OPTIONS,GET,POST,PUT,PATCH,DELETE,HEAD");
        cors.setInitParameter(CrossOriginFilter.ALLOW_CREDENTIALS_PARAM, "true");

        cors.addMappingForUrlPatterns(EnumSet.allOf(DispatcherType.class), true, "/*");
    }
}
