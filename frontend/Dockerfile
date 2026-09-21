FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_AUTH_URL
ARG VITE_GATEWAY_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]