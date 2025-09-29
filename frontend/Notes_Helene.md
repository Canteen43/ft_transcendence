SECURITY CONCERNS / TODO:

Password hashing:

- password encryption in the database - to do (Any password stored in your database, if applicable, must be hashed.)
  Strong password hashing algorithms: argon2id (best), bcrypt with cost ≥ 12, or scrypt.
  Don’t use: MD5, SHA1, SHA256 alone. (Too fast, insecure for passwords).

Protect against SQL injection and XSS

- SQL Injection: Happens when user input is directly used in queries.
  -> Always use prepared statements / query builders / ORMs.
  "SELECT \* FROM users WHERE email = ? " -- parameterized, safe
- XSS (Cross-Site Scripting): Happens when user input is injected into HTML/JS.
  malicious user JS injectioninto your app, e.g., <script>alert('hacked')</script>.
    - What happens without escaping
      p.innerHTML = c; // DO NOT DO THIS!
      Any <script> in c would execute immediately → XSS attack.
      How you fight it:
    - Sanitize input: remove or escape HTML tags before storing or rendering.
        - Backend sanitizes/escapes stored data → stops persistent XSS
          (import sanitizeHtml from 'sanitize-html';
          const safeText = sanitizeHtml(text, {
          allowedTags: [], // remove all HTML tags
          allowedAttributes: {}
          });)
    - Escape output: when displaying user-generated content in HTML, escape <, >, " etc.
        - Frontend escapes or uses frameworks that auto-escape (React, Vue) → stops reflected XSS
          // Escape user input by using textContent
          p.textContent = c;
          Using textContent is the vanilla JS equivalent of what React/Vue auto-escaping does.
          It ensures any text you insert is treated as literal text, not HTML, so scripts won’t run.
    - Escaping stops XSS
      Using textContent (vanilla JS) ensures that <script>alert('XSS')</script> is
      displayed literally, not executed. This means any JWTs or sensitive info in your
      frontend cannot be stolen via XSS, as long as nothing in the page is vulnerable.
- Validate all user input
  Prevent malicious input and data corruption. Validate on the server (mandatory).
  How: Check for type, length, format.
  const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  });
  Front end as well: Validate forms before sending them (check email format, re-
  quired fields, password length, etc.). Backend must re-validate.

Use HTTPS (TLS encryption)
All communication must be encrypted.
http:// → insecure, https:// → secure

- For development: self-signed (Node.js can handle it).
- For production: use Let’s Encrypt.
  const fastify = Fastify({
  https: {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt')
  }
  });
- WebSockets must also be secure: ws:// → ❌, wss:// → ✅

Routes that require authentification (message, profile) -> JWT
fastify.get('/profile', async (request, reply) => {
const authHeader = request.headers['authorization'];
if (!authHeader) return reply.status(401).send({ error: 'Unauthorized' });

const token = authHeader.split(' ')[1];
try {
const user = verifyJWT(token); // your JWT verification function
return { email: user.email };
} catch {
return reply.status(401).send({ error: 'Invalid token' });
}
});

What is sessionStorage? A built-in web API in browsers.
-> Works like a tiny key–value database. Values are stored as strings.
-> Storage is per tab:
If you open a new tab, sessionStorage is empty there.
If you close the tab or browser, everything in sessionStorage is erased.
-> it’s perfect for temporary auth state like your login token.

sessionStorage vs localStorage vs global variable

- localStorage: persists even after closing/reopening the browser-> less secure
- sessionStorage: resets once the tab/window is closed.
- global variable: disappear when page is refreshed

functions: getItem, setItem, removeItem

https://www.shutterstock.com/g/Wibisono+Adi+Kirana?page=9


- tournament variable in session data: 1 when the tournament button is selected - 
for local: put back to 0 when we have a winner  (and when we quit -> todo)



buttonText ?? 'Okay'
buttonText? buttonText : 'Okay'



z-index:
- authButton 'z-10'
- home button 'z-10'
- alias AI toggle down background: 'z-10'
- modal 'z-20'
- banner 'z-30'
- textModal 'z-30'