# ---- Stage 1: Build ----
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /build

# Copy POM first to leverage Docker layer caching for dependency downloads
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build fat JAR
COPY src ./src
RUN mvn package -DskipTests -B

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy the fat JAR produced by maven-shade-plugin
COPY --from=builder /build/target/evenly-api-*.jar evenly-api.jar

# Copy the production config template
COPY config.yml config.yml

EXPOSE 8080
EXPOSE 8081

CMD ["java", "-jar", "evenly-api.jar", "server", "config.yml"]
