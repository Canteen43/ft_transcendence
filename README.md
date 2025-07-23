# Transcendence

A full-stack web application featuring a real-time multiplayer Pong game with user authentication, tournaments, and social features, built with modern web technologies.

> ⚠️ **Note:** Development has just started. There is nothing implemented yet.

## Design considerations

### Authoritative server vs Client-side simulation
- **Authoritative server:** Server keeps track of game state (ball and paddle position) and frontend just renders and sends movements to server
	- **Pros:** Closer to real world, less confusion
- **Client-side simulation:** Frontend calculates whole game logic and just sends paddle position to other users
	- **Pros:** Position can update instantly because it doesn't have to be sent to the server
- **Preliminary decision:** Authoritative server

### Separation of labour
- **Database container:** Just contains the database and its manager process
- **Backend container:** Handles game loop and whatnot
- **Frontend container:** A webserver that sends the frontend code to the client upon request and acts as a reverse proxy

### Flow of Information
- **Client (Webbrowser)** <--> **Reverse Proxy (Webserver Container)** <--> **Backend container** <--> **Database**

---

*This project is part of the 42 School curriculum.*