# Transcendence

A full-stack web application featuring a real-time multiplayer Pong game with user authentication, tournaments, and social features, built with modern web technologies.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Project structure](#project-structure)

---

## Features

- Real-time multiplayer gameplay using WebSockets.
- In-game power-ups (paddle resize, 2 balls, etc.).
- Score tracking and game history.
- User authentication using 2FA and JWT tokens.
- Responsive front-end interface built with modern web technologies.
- Containerized backend and frontend for easy deployment.

## Tech Stack

- **Frontend:** Tailwind CSS / Babylon.js
- **Backend:** Node.js / Fastify
- **Database:** SQLite
- **Containerization:** Docker, Docker Compose

## Installation

# Clone the repository

git clone https://github.com/Canteen43/ft_transcendence
cd transcendence

# Build the containers

make build

## Usage

# Launch and stop

make up
make down

# Default URL

http://localhost:8000/

## Project structure

project-root/
├─ frontend/ # Frontend source code
│ ├─ src/ # Source files
│ ├─ vite.config.ts # Vite configuration
│
├─ backend/ # Backend source code
│ ├─ connection_manager/ # Web socket connection manager
│ ├─ game/ # Web socket game protocol
│ ├─ repositories/ # Database access
│ ├─ routes/ # Fastify api routes
│ ├─ services/ # Services
│
├─ shared/ # Shared code (used by frontend & backend)
│ └─ schemas/ # TypeScript schemas, constants, utils
│
├─ build/ # Production build assets
│ ├─ frontend/ # Frontend Dockerfile, .env
│ │ └─ Dockerfile
│ ├─ backend/ # Backend Dockerfile
│ │ ├─ Dockerfile
│ │ └─ .env
│ └─ database/ # Production database files
│
├─ .gitignore
├─ docker-compose.yml
├─ Makefile
├─ package.json/ # Npm dependencies
└─ README.md
