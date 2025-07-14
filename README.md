# Transcendence

> ⚠️ **Note:** Development has just started. There is nothing implemented yet.

A full-stack web application featuring a real-time multiplayer Pong game with user authentication, tournaments, and social features, built with modern web technologies.

## Design considerations

### Authoritative server vs Client-side simulation
- **Authoritative server:** Server keeps track of game state (ball and paddle position) and frontend just renders and sends movements to server
	- **Pros:** Closer to real world, less confusion
- **Client-side simulation:** Frontend calculates whole game logic and just sends paddle position to other users
	- **Pros:** Position can update instantly because it doesn't have to be sent to the server
- **Preliminary decision:** Authoritative server

---

*This project is part of the 42 School curriculum.*