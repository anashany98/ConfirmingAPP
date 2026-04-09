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

# Remove default nginx html contents
RUN rm -rf /usr/share/nginx/html/*

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy a script that will copy built assets to nginx html directory on container start
COPY copy-assets.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/copy-assets.sh

# Set the entrypoint to our script
ENTRYPOINT ["/usr/local/bin/copy-assets.sh"]

# Explicitly expose port 8095
EXPOSE 8095
