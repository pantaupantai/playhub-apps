FROM node:20-alpine

WORKDIR /app

# Install curl & tzdata
RUN apk add --no-cache curl tzdata

# Set timezone & production mode
ENV TZ=Asia/Makassar
ENV NODE_ENV=production

# Copy package definition
COPY package.json package-lock.json* ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application files
COPY . .

# Expose server port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Start Express server
CMD ["node", "server.js"]
