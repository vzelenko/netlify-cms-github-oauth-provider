FROM node:alpine

WORKDIR /services/webhooks

COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

COPY index.js ./

EXPOSE 3000

CMD ["node", "index.js"]
