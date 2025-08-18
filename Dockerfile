# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=22.16.0

################################################################################
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine as base

# Set working directory for all build stages.
WORKDIR /usr/src/app


################################################################################
# Create a stage for installing production dependecies.
FROM base AS deps

# Copy manifest and install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

################################################################################
# Create a stage for building the application.
FROM base AS build

# Install all deps to build
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source files and build
COPY . .
RUN npm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base AS final

WORKDIR /usr/src/app

# Copy runtime assets
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY resources ./resources

# Ensure non-root user can write to runtime directories (e.g., resources/assinados)
RUN chown -R node:node /usr/src/app


# Expose the port that the application listens on.
EXPOSE 3000

# Run as non-root and start the compiled app.
USER node

# Run the application.
CMD ["node", "dist/main.js"]
