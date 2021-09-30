FROM node:16.10.0-alpine3.14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Install all dependencies
RUN apk upgrade --update && \
  apk add --no-cache -t build-dependencies make gcc g++ python2 libtool autoconf automake youtube-dl && \
  npm install

# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . /usr/src/app/

RUN npm run build

CMD [ "npm", "start" ]
EXPOSE 9000