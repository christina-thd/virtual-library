# Home Assistant passes BUILD_ARCH (amd64, aarch64, …). Newer Supervisors no longer pass
# BUILD_FROM, so default to the official base image for that architecture.
# Pinned to Alpine 3.22, which ships Node.js 22 (LTS), the version the tests run on (.github/workflows):
# it's the newest base image for every architecture in config.yaml (armhf, armv7 and i386 stop at 3.22).
ARG BUILD_ARCH=amd64
ARG BUILD_FROM=ghcr.io/home-assistant/${BUILD_ARCH}-base:3.22
FROM $BUILD_FROM

# The app has no npm dependencies, so Node.js is all it needs
RUN apk add --no-cache nodejs

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public

# Copy run script
COPY run.sh /
RUN chmod a+x /run.sh

# Web interface (Home Assistant ingress, and the optional direct port)
EXPOSE 3100/tcp

# Runs as root: the library is saved in /data, which Home Assistant mounts owned by root.
CMD [ "/run.sh" ]
