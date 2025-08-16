# Transcendence

A full-stack web application featuring a real-time multiplayer Pong game with user authentication, tournaments, and social features, built with modern web technologies.

> ⚠️ **Note:** Development has just started. There is nothing implemented yet.

## Design considerations

### Authoritative server vs Client-side simulation

-   **Authoritative server:** Server keeps track of game state (ball and paddle position) and frontend just renders and sends movements to server
    -   **Pros:** Closer to real world, less confusion
-   **Client-side simulation:** Frontend calculates whole game logic and just sends paddle position to other users
    -   **Pros:** Position can update instantly because it doesn't have to be sent to the server
-   **Preliminary decision:** Authoritative server

### Separation of labour

-   **Database container:** Just contains the database and its manager process
-   **Backend container:** Handles game loop and whatnot
-   **Frontend container:** A webserver that sends the frontend code to the client upon request and acts as a reverse proxy

### Flow of Information

**Client (Webbrowser)** <--> **Reverse Proxy (Webserver/ Frontend Container)** <--> **Backend container** <--> **Database**

### WebSocket

-   **What?:** WebSocket is a protocol, just like HTTP. It has a minimal frame and the content is completely free to choose. Also, it's bidirectional.
-   **Why?:** They are efficient for data transfer. They especially make it easier to send stuff from the server to the client.
-   **How?:** The websocket connection will be established after the HTTP connection. It will be routed from the Frontend container to the backend container.
-   **Visualization:**

```
Browser                Server
-------                ------
GET / HTTP/1.1 ───────►
                      ◄─── 200 OK + HTML + JS
parse/run JS
new WebSocket() ──────►
GET /socket Upgrade ─►
                      ◄─── 101 Switching Protocols
[ WebSocket frames ]◄─►
```

### HTTP Version

-   **Probably 1.1**

### Game Design Ideas

-   **Theme: Retro Pong**
-   **Customization: Paddle Skin, Background, etc**
-   **Loadouts: E.g. investing in offensive or defensive power ups before the game**
-   **Adding a story mode?**

---

_This project is part of the 42 School curriculum._
