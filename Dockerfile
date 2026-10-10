FROM oven/bun:1.4.3-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY index.ts tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
COPY scripts ./scripts

RUN bun build --compile --outfile location-game ./index.ts

FROM alpine:3.24

RUN apk add --no-cache ca-certificates libstdc++ libgcc fontconfig font-dejavu tzdata
ENV TZ=Europe/Istanbul

WORKDIR /app

COPY --from=build /app/location-game ./location-game
COPY --from=build /app/drizzle ./drizzle

CMD ["./location-game"]
