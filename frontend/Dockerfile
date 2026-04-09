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

# Create a tarball with the built files to transfer to the final image
RUN tar -cf /tmp/dist.tar -C /app/dist .

# Stage 2: Serve
FROM nginx:alpine

# Remove default nginx html contents
RUN rm -rf /usr/share/nginx/html/*

# Extract the built files at runtime (after volumes are mounted)
COPY --from=build /tmp/dist.tar /tmp/dist.tar
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create a startup script that extracts files AFTER volumes are mounted
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Explicitly expose port 8095
EXPOSE 8095

CMD ["/start.sh"]
