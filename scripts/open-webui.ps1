#!/usr/bin/env pwsh
# Download Open WebUI Docker Compose with NVIDIA GPU support

$ErrorActionPreference = 'Stop'

$composeUrl = 'https://raw.githubusercontent.com/open-webui/open-webui/refs/heads/main/docker-compose.yaml'
$outputFile = 'docker-compose.yml'

Write-Host "Downloading Open WebUI docker-compose.yml..."
Invoke-WebRequest -Uri $composeUrl -OutFile $outputFile

Write-Host "Starting Open WebUI with Docker Compose..."
docker compose up -d

Write-Host "Open WebUI is running at http://localhost:3000"
