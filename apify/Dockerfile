FROM apify/actor-node:20

COPY package*.json ./
RUN npm ci --omit=dev

COPY . ./

ENV DEPLOYMENT_MODE=public
ENV ATTRIBUTION_SOURCE=apify

CMD ["npx", "tsx", "apify/main.ts"]
