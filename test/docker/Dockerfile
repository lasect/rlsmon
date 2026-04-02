FROM postgres:16-alpine

# Install additional extensions
RUN apk add --no-cache \
    postgresql16-contrib \
    uuidgen

# Enable required extensions
RUN echo "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" > /docker-entrypoint-initdb.d/01-extensions.sql
RUN echo "CREATE EXTENSION IF NOT EXISTS pgcrypto;" >> /docker-entrypoint-initdb.d/01-extensions.sql
RUN echo "CREATE EXTENSION IF NOT EXISTS citext;" >> /docker-entrypoint-initdb.d/01-extensions.sql

# Copy custom configuration
COPY postgresql.conf /etc/postgresql/postgresql.conf

EXPOSE 5432
