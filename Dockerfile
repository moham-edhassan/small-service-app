FROM node:22-bookworm AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

COPY . .

ENV OLLAMA_URL=http://ollama:11434
ENV OLLAMA_MODEL=llama3:8b-instruct
ENV WHISPER_MODEL=large-v3

EXPOSE 3000

CMD ["npm", "run", "dev"]
