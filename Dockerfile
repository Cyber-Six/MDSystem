FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY mds-patient/package.json mds-patient/package.json
COPY mds-staff/package.json mds-staff/package.json
RUN npm ci --ignore-scripts
COPY packages/core packages/core
COPY mds-patient mds-patient
COPY mds-staff mds-staff
ARG VITE_PATIENT_BACKEND_URL=https://www.mdsystemtip.space
ARG VITE_STAFF_BACKEND_URL=https://staff.mdsystemtip.space
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_RECAPTCHA_SITE_KEY=
ARG VITE_PATIENT_DEV_PORTAL=www
ARG VITE_STAFF_DEV_PORTAL=staff
ENV VITE_PATIENT_BACKEND_URL=$VITE_PATIENT_BACKEND_URL \
    VITE_STAFF_BACKEND_URL=$VITE_STAFF_BACKEND_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_PATIENT_DEV_PORTAL=$VITE_PATIENT_DEV_PORTAL \
    VITE_STAFF_DEV_PORTAL=$VITE_STAFF_DEV_PORTAL
RUN npm run build:patient && npm run build:staff

FROM node:22-bookworm-slim AS production-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app/Backend
COPY Backend/package.json Backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 LOGGER_DIR=/tmp/mdsystem-logs MEDIA_PATH=/app/media \
    POST_BUILD_SETUP_SQL_PATH=/app/Backend/config/data/post_build_setup.sql
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    fonts-liberation gosu && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --create-home app
WORKDIR /app
COPY --from=production-deps --chown=app:app /app/Backend/node_modules Backend/node_modules
COPY --chown=app:app Backend Backend
COPY --from=build --chown=app:app /app/mds-patient/dist mds-patient/dist
COPY --from=build --chown=app:app /app/mds-staff/dist mds-staff/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
EXPOSE 3000 3001
CMD ["node", "Backend/server.js"]
