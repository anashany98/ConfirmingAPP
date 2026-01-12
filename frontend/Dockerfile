# Stage 1: Build
FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept API URL as a build argument
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the app (output to /app/dist)
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Explicitly expose port 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
