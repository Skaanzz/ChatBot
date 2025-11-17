# syntax=docker/dockerfile:1
FROM node:18-alpine

WORKDIR /usr/src/app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source files
COPY index.js ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "launch"]
