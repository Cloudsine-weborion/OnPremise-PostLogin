# Use the official Node.js image
FROM node:18-alpine

# Install necessary dependencies for Puppeteer and bash, curl, cron
RUN apk add --no-cache \
    bash \
    curl \
    busybox-suid \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libstdc++ \
    libc6-compat

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Set Puppeteer environment variable to use the installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set up cron jobs
RUN echo "*/10 * * * * cd /app && node login-automation-files/login-comcollab.sysdev.id.js" >> /etc/crontabs/root && \
    echo "*/10 * * * * cd /app && node login-automation-files/login-edminfo.js" >> /etc/crontabs/root && \
    echo "*/10 * * * * cd /app && node login-automation-files/login-helpdesk.sysdev.id.js" >> /etc/crontabs/root && \
    echo "*/10 * * * * cd /app && node login-automation-files/login-single.sysdev.id.js" >> /etc/crontabs/root

# Start both the cron service and the main application
CMD ["sh", "-c", "crond && node index.js"]
