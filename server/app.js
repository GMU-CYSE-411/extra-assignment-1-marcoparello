

const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { DEFAULT_DB_FILE, openDatabase } = require("../db");


//require Bcrypt for password comparsion
const bcrypt = require("bcrypt");


function sendPublicFile(response, fileName) {
  response.sendFile(path.join(__dirname, "..", "public", fileName));
}

//function to generate csrf tokens
function csrfTokenGen(){
  return crypto.randomBytes(32).toString("hex");
}
//origin validation
function validateOrigin(request, response, next) {
  const allowed = "http://localhost:3000";
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  if (origin && origin !== allowed) {
    return response.status(403).send("Forbidden");
  }
  if (referer && !referer.startsWith(allowed)) {
    return response.status(403).send("Forbidden");
  }
  next();
}


//function to remove old csrf tokens (viewing each page generates a new one, but there should only be one)
function csrfTokenRefresh(){
  //attempt to remove an old csrf token if it existsSync
  try {
    delete session.csrfToken;
  //if there is an error don't do anything
  } catch(error) {
    
  }
}

function createSessionId() {
  //Math.random() is not actually cryptographically secure. A session key should be at least 128 bits to be cryptographically secure. Additionally, 
  // Date.now() leaks the timing of login, meaning that attackers can guess the timestamp window.
  //Therefore, a better implementation to create a session ID would be to use crypto.
  //return `SESSION-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `SESSION-${[...bytes].map(b => b.toString(16).padStart(2, "0")).join("")}`;
}

//checks to see if the session ID follows the correct session format
function isValidSID(sid){
  return /^SESSION-[A-Fa-f0-9]{32}$/.test(sid);
}

async function createApp() {
  if (!fs.existsSync(DEFAULT_DB_FILE)) {
    throw new Error(
      `Database file not found at ${DEFAULT_DB_FILE}. Run "npm run init-db" first.`
    );
  }

  const db = openDatabase(DEFAULT_DB_FILE);
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use("/css", express.static(path.join(__dirname, "..", "public", "css")));
  app.use("/js", express.static(path.join(__dirname, "..", "public", "js")));

  app.use(async (request, response, next) => {
    const sessionId = request.cookies.sid;

    if (!sessionId) {
      // if there isn't a session ID, not just the currentUser should be set to null. The entire session should!
      //request.currentUser = null;
      request.session = null;
      next();
      return;
    }
    //There isn't any authentication that the session ID is valid. Therefore, I will create session ID checks using isValidSID
    //------------------------------------------------------------------------------------------------------------------------
    // Check if the SessionID is the valid format. If it isn't, send a 401 error 
    if (!isValidSessionId(sid)) {
      return res.status(401).send("Invalid session");
    }

    //
    const row = await db.get(
      `
        SELECT
          sessions.id AS session_id,
          users.id AS id,
          users.username AS username,
          users.role AS role,
          users.display_name AS display_name
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.id = ?
      `,
      [sessionId]
    );

    request.currentUser = row
      ? {
          sessionId: row.session_id,
          id: row.id,
          username: row.username,
          role: row.role,
          displayName: row.display_name
        }
      : null;

    next();
  });
//--------------------------------------------------------------------------------------------
  function requireAuth(request, response, next) {
    //Checks current user, not session
    //if (!request.currentUser) {
    //Now check if it is not the requested session, or if the requested user.role is not admin
    if (!req.session || req.session.user.role !== "admin") {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    next();
  }

  app.get("/", (_request, response) => sendPublicFile(response, "index.html"));
  app.get("/login", (_request, response) => sendPublicFile(response, "login.html"));
  app.get("/notes", (_request, response) => sendPublicFile(response, "notes.html"));
  app.get("/settings", (_request, response) => sendPublicFile(response, "settings.html"));
  app.get("/admin", (_request, response) => sendPublicFile(response, "admin.html"));

  app.get("/api/me", (request, response) => {
    response.json({ user: request.currentUser });
  });

  //---------------Added Ratelimiting ---------------------
  //Before the system allowed unlimited login attempts, opening it up to brute force attackers
  // I have therefore limited that
  const rateLimit = require("express-rate-limit");

  app.use("/api/login", rateLimit({
    windowMs: 15*60*1000,
    max: 5

  }));
  // ---------------Insecure Login-----------------------------------
  app.post("/api/login", validateOrigin, async (request, response) => {
    const username = String(request.body.username || "");
    const password = String(request.body.password || "");

    // SQL injection vulnerability, implement parameterized queries instead
    //const query = `
      //SELECT id, username, role, display_name
      //FROM users
      //WHERE username = '${username}' AND password = '${password}'
    //`;

    //no async for checking and verifying
    //const user = await db.get(query)

    const query = `
      SELECT id, username, role, display_name
      FROM users
      WHERE username = ? AND password = ?
    `;
    //make async for checking and verifying
  await db.get(query,[username,password], async (err,user) =>{
      if (!user) {
        return response.status(401).json({ error: "Invalid username or password." });
        }
      //bcrypt password check

      const bcrypt_check = await bcrypt.compare(password, user.password);
      
      //if bcrypt check fails, return error

      if (!bcrypt_check) {
        return response.status(401).json({ error: "Invalid username or password." });
        }
      
      //delete the old session if there is an old session

      const oldSession = request.cookies.sid;
      if (oldSession){
          await db.run("DELETE FROM sessions WHERE id = ?", [oldSession]);

      }

      // regenerate a new session ID
      const sessionId = createSessionID();

      await db.run(
      "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
      [sessionId, user.id, new Date().toISOString()]
      );

    //Not a secure cookie, missing httpOnly, sameSite, and secure
    //response.cookie("sid", sessionId, {
      //path: "/"
    //});

    response.cookie("sid", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      //webserver is http, not https so cannot use secure
      secure:false,
      path: "/"
    });

    response.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name
      }
    });
    
  });
      
      
      

    


    //Vulnerability, doesn't always generate a new session ID as it can get it from the cookies. To prevent session fixation, always
    //generate a new session ID
    //const sessionId = request.cookies.sid || createSessionId();
    

    

    //Not a secure cookie, missing httpOnly, sameSite, and secure
    //response.cookie("sid", sessionId, {
      //path: "/"
    //});

  

    
  });
//------------------------------------------------------------------------
  app.post("/api/logout", validateOrigin,async (request, response) => {
    // not secure - sid isn't validated before using it
    const sid = isValidSID(request.cookies.sid)
    try  {
      if (sid){
      await db.run("DELETE FROM sessions WHERE id = ?", [sid]);
      }
   }catch(err){
    return response.status(500).json({error: "Logout Failed"});

    }
    // need to modify to contain the same cookie flags as the login or else won't work
    //response.clearCookie("sid");
    //response.json({ ok: true });
    response.clearCookie("sid", {
      httpOnly: true,
      sameSite: "lax",
      //webserver is http, not https so cannot use secure
      secure:false,
      path: "/"
    });
  res.json({ok:true});
  });

  app.get("/api/notes", requireAuth, async (request, response) => {
    // Vulnerability! - Missing CSRF token, mitigates CSRF by creating a token only on the server side,
    //refresh old CSRF tokens
    csrfTokenRefresh();
    const csrfToken = csrfTokenGen();
    //generate the CSRF token for the session
    request.session.csrfToken = csrfToken;

    const ownerId = request.query.ownerId || request.currentUser.id;
    const search = request.query.search || "";

    //like could be escaped!. Also running direct variables into code.
    //fix
    //use sanitization
    const like = `%${search.replace(/[%_]/g, "\\$&")}%`;
    //parameterize queries
    const notes = await db.all(`
      SELECT
        notes.id,
        notes.owner_id AS ownerId,
        users.username AS ownerUsername,
        notes.title,
        notes.body,
        notes.pinned,
        notes.created_at AS createdAt
      FROM notes
      JOIN users ON users.id = notes.owner_id
      WHERE notes.owner_id = ?
        AND (notes.title LIKE ? ESCAPE '\\' OR notes.body LIKE ? ESCAPE '\\')
      ORDER BY notes.pinned DESC, notes.id DESC
    `,[ownerId,like,like]);
    //render CSRF token
    response.render("/api/notes",{csrfToken});
    response.json({ notes });
   
  });

  app.post("/api/notes", validateOrigin, requireAuth, async (request, response) => {
    const ownerId = Number(request.body.ownerId || request.currentUser.id);
    const title = String(request.body.title || "");
    const body = String(request.body.body || "");
    const pinned = request.body.pinned ? 1 : 0;

    //validate CSRF token, 
    if (request.body.csrfToken !== request.session.csrfToken){
      return response.status(403).send("CSRF validation failed");
    }
    //if CSRF token passes validation, proceed with execution
    if (request.body.csrfToken == request.session.csrfToken){
      const result = await db.run(
      "INSERT INTO notes (owner_id, title, body, pinned, created_at) VALUES (?, ?, ?, ?, ?)",
      [ownerId, title, body, pinned, new Date().toISOString()]
    );

    response.status(201).json({
      ok: true,
      noteId: result.lastID
    });
    }
    
  });

  app.get("/api/settings", requireAuth, async (request, response) => {
    // Refresh old csrf tokens
    csrfTokenRefresh();
    // Vulnerability! - Missing CSRF token, mitigates CSRF by creating a token only on the server side,
    const csrfToken = csrfTokenGen();
    //generate the CSRF token for the session
    request.session.csrfToken = csrfToken;
    //Insecure! another user should not be able to view another user's settings
    //const userId = Number(request.query.userId || request.currentUser.id);
    //Fix
    const userId = Number(request.currentUser.id);

    const settings = await db.get(
      `
        SELECT
          users.id AS userId,
          users.username,
          users.role,
          users.display_name AS displayName,
          settings.status_message AS statusMessage,
          settings.theme,
          settings.email_opt_in AS emailOptIn
        FROM settings
        JOIN users ON users.id = settings.user_id
        WHERE settings.user_id = ?
      `,
      [userId]
    );
    //render CSRF token
    response.render("/api/settings",{csrfToken});

    response.json({ settings });
  });

  app.post("/api/settings", validateOrigin, requireAuth, async (request, response) => {
    //Again, users should not be able to update another user's settings
    //const userId = Number(request.body.userId || request.currentUser.id);
    //fix
    const userId = Number(request.currentUser.id);
    const displayName = String(request.body.displayName || "");
    const statusMessage = String(request.body.statusMessage || "");
    const theme = String(request.body.theme || "classic");
    const emailOptIn = request.body.emailOptIn ? 1 : 0;

     //validate CSRF token, 
    if (request.body.csrfToken !== request.session.csrfToken){
      return response.status(403).send("CSRF validation failed");
    }

    // if CSRF token passes validation, proceed
    if (request.body.csrfToken == request.session.csrfToken){

    await db.run("UPDATE users SET display_name = ? WHERE id = ?", [displayName, userId]);
    await db.run(
      "UPDATE settings SET status_message = ?, theme = ?, email_opt_in = ? WHERE user_id = ?",
      [statusMessage, theme, emailOptIn, userId]
    );

    response.json({ ok: true });
  }
  });

  app.get("/api/settings/toggle-email", requireAuth, async (request, response) => {
   
    const enabled = request.query.enabled === "1" ? 1 : 0;
   

    await db.run("UPDATE settings SET email_opt_in = ? WHERE user_id = ?", [
      enabled,
      request.currentUser.id
    ]);
    


    response.json({
      ok: true,
      userId: request.currentUser.id,
      emailOptIn: enabled
    });
  });

  app.get("/api/admin/users", requireAuth, async (_request, response) => {
    const users = await db.all(`
      SELECT
        users.id,
        users.username,
        users.role,
        users.display_name AS displayName,
        COUNT(notes.id) AS noteCount
      FROM users
      LEFT JOIN notes ON notes.owner_id = users.id
      GROUP BY users.id, users.username, users.role, users.display_name
      ORDER BY users.id
    `);

    response.json({ users });
  });

  return app;
}

module.exports = {
  createApp
};
