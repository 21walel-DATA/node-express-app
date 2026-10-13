# Dockerfile
# The recipe for building an "image": a packaged copy of the app together
# with everything it needs to run. Railway builds this image and runs it.
# Each line below is one step of the recipe.

# Start from an official image that already has Node.js 24 installed.
# "slim" is a smaller version of Linux with fewer extras.
FROM node:24-slim

# Install the tools needed to build better-sqlite3.
# That library is written partly in C++, so "npm ci" has to compile it for
# Linux, and compiling needs Python, make and a C++ compiler (g++).
# The last line deletes apt's download lists to keep the image smaller.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# All the following steps happen inside this folder in the image
WORKDIR /app

# Copy only the two package files first, then install.
# Docker remembers (caches) each step, so when only our own code changes it
# can skip this slow install step on the next build.
COPY package.json package-lock.json ./

# Install exactly the versions listed in package-lock.json.
# --omit=dev leaves out tools only needed while developing (nodemon, supertest).
RUN npm ci --omit=dev

# Now copy the rest of the app (.dockerignore lists what is left out)
COPY . .

# Tells Express and other libraries that this is the live site
ENV NODE_ENV=production

# The port the app listens on when PORT is not set. Railway sets PORT itself.
EXPOSE 3000

# The command that starts the app when the container starts
CMD ["node", "index.js"]
