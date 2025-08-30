# Dockerfile (multi-stage): build with dev deps, produce small runtime image
FROM node:18-alpine AS builder
WORKDIR /app

# Install all deps (including dev) so TypeScript and Prisma generation work
COPY package*.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client (so types exist) and build TypeScript
RUN npx prisma generate
RUN npm run build

# ----- runtime stage -----
FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only necessary files from builder
# Copy node_modules (contains @prisma/client and generated client)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# If you use prisma runtime files (optional), copy prisma folder
COPY --from=builder /app/prisma ./prisma
# copy package.json for completeness
COPY package*.json ./

EXPOSE 8080
CMD ["node", "dist/index.js"]
