# syntax=docker/dockerfile:1
FROM node:18-alpine

WORKDIR /usr/src/app

# Install only production dependencies for the API (located in ./api)
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev

# Copy API source
COPY api/index.js ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "launch"]
