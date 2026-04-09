FROM node:24-alpine AS build

WORKDIR /app

# Copy package files before source so Docker can cache the npm install layer,
# skipping it on rebuilds when only source files have changed.
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
