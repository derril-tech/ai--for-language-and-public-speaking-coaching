FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build --workspace=gateway

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/gateway/dist ./dist
COPY apps/gateway/package.json ./package.json
RUN npm i --omit=dev --ignore-scripts && npm cache clean --force
EXPOSE 4000
CMD ["node", "dist/main.js"]

