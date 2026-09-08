# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server_bin main.go

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata curl && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Bangkok

COPY --from=builder /app/server_bin .
COPY --from=builder /app/assets ./assets

RUN mkdir -p uploads barcode QRCode

EXPOSE 8080

CMD ["./server_bin"]
