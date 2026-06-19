FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Set at pack/deploy time (GitHub secret CAPROVER_API_HOST or manual edit)
ARG VITE_API_URL=https://ems-api.CHANGE_ME.com/api
ARG VITE_SOCKET_URL=https://ems-api.CHANGE_ME.com
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
