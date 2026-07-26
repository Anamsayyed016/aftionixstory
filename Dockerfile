FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG STORYVERSE_BUILD_ID=unknown
ARG STORYVERSE_BUILT_AT
ENV STORYVERSE_BUILD_ID=$STORYVERSE_BUILD_ID
ENV STORYVERSE_BUILT_AT=$STORYVERSE_BUILT_AT
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Regenerate Prisma client against the full schema (deps stage has no prisma/).
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ARG STORYVERSE_BUILD_ID=unknown
ARG STORYVERSE_BUILT_AT
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV STORYVERSE_BUILD_ID=$STORYVERSE_BUILD_ID
ENV STORYVERSE_BUILT_AT=$STORYVERSE_BUILT_AT

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && apk add --no-cache su-exec \
  && mkdir -p /app/public/uploads/images \
  && chown -R nextjs:nodejs /app/public

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
  && mkdir -p /app/public/uploads/images \
  && chown -R nextjs:nodejs /app/public

# Entrypoint runs as root briefly to chown the uploads volume, then drops to nextjs.
USER root
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
