FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# Set environment to allow external connections
ENV HOST=0.0.0.0

CMD ["npm", "start"]

