FROM node:22-bookworm

WORKDIR /app

# Install build dependencies for native modules (leveldown)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node src ./src

# Build TypeScript
RUN npm run build

# Create data directories with proper ownership
RUN mkdir -p /data/db /data/artifacts && chown -R node:node /data /app

ENV DB_DIR=/data/db
ENV ARTIFACT_DIR=/data/artifacts
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["npm", "start"]
