# Use a current LTS Node.js image (Express 5 and redis v5 need Node 18+)
FROM node:26-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package files first so dependency installs are cached
COPY package*.json ./

# Install production dependencies only (nodemon/jest aren't needed to run)
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    REDIS_HOST=redis \
    REDIS_PORT=6379

# Run as non-root user
RUN chown -R node:node /usr/src/app
USER node

# Expose the application port
EXPOSE 3000

# The app has no /health route, so check that the port accepts connections
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('net').connect(process.env.PORT||3000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

# Start the
CMD ["npm", "start"]  