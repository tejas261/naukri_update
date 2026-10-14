# Install only Chromium, using the exact Playwright version in package-lock.json.
FROM node:22-bookworm-slim

USER root
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb xauth x11vnc fluxbox x11-utils \
    && ./node_modules/.bin/playwright-core install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm
COPY . .
RUN chmod +x deploy/oracle/entrypoint.sh && install -d -o node -g node -m 700 /data
ENV DATA_DIR=/data BROWSER_CHANNEL=bundled TZ=Asia/Kolkata DISPLAY=:99
USER node
ENTRYPOINT ["/app/deploy/oracle/entrypoint.sh"]
CMD ["node", "deploy/oracle/smoke.js"]
