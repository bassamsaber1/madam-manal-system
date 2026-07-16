FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git git-lfs ca-certificates \
  && git lfs install \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN git lfs pull

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
