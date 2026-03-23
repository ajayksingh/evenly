package com.ajayksingh.evenly.auth;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import io.dropwizard.auth.AuthenticationException;
import io.dropwizard.auth.Authenticator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

public class SupabaseJwtAuthenticator implements Authenticator<String, EvenlyPrincipal> {

    private static final Logger LOG = LoggerFactory.getLogger(SupabaseJwtAuthenticator.class);

    private final JWTVerifier verifier;

    public SupabaseJwtAuthenticator(String jwtSecret) {
        Algorithm algorithm = Algorithm.HMAC256(jwtSecret);
        this.verifier = JWT.require(algorithm)
                .withIssuer("supabase")
                .build();
    }

    @Override
    public Optional<EvenlyPrincipal> authenticate(String token) throws AuthenticationException {
        try {
            DecodedJWT decoded = verifier.verify(token);
            String userId = decoded.getSubject();
            String email = decoded.getClaim("email").asString();

            if (userId == null || userId.isBlank()) {
                LOG.warn("JWT token missing sub claim");
                return Optional.empty();
            }

            return Optional.of(new EvenlyPrincipal(userId, email));
        } catch (JWTVerificationException e) {
            LOG.debug("JWT verification failed: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
