function noteCard(note) {
  //HTML Parsing Vulnerability!
 // return `
   // <article class="note-card">
  //    <h3>${note.title}</h3>
   //   <p class="note-meta">Owner: ${note.ownerUsername} | ID: ${note.id} | Pinned: ${note.pinned}</p>
   //   <div class="note-body">${note.body}</div>
   // </article>
 // `;
 
 //Generating page manually
 const note_page = document.createElement("article");
 note_page.className="note-card";
 const note_page_h3 = document.createElement("h3");
 note_page_h3.textContent = note.title;
 const note_page_meta = document.createElement("p");
 note_page_meta.className = "note-meta";
 note_page_meta.textContent = `Owner: ${note.ownerUsername} | ID: ${note.id} | Pinned: ${note.pinned}`;
 const note_page_body = document.createElement("div");
 note_page_body.className = "note-body";
 note_page_body.textContent = note.body;
 note_page.appendChild(note_page_h3);
 note_page.appendChild(note_page_meta);
 note_page.appendChild(note_page_body);
 return note_page;


}

async function loadNotes(ownerId, search) {
  const query = new URLSearchParams();

  if (ownerId) {
    query.set("ownerId", ownerId);
  }

  if (search) {
    query.set("search", search);
  }

  const result = await api(`/api/notes?${query.toString()}`);
  const notesList = document.getElementById("notes-list");
  //InnerHTML vulnerability!
  //notesList.innerHTML = result.notes.map(noteCard).join("");

  //Fix
  //clear notesList
  notesList.textContent = "";
  for (const note of result.notes){
    notesList.appendChild(noteCard(note));
  }
}

(async function bootstrapNotes() {
  try {
    const user = await loadCurrentUser();

    if (!user) {
      document.getElementById("notes-list").textContent = "Please log in first.";
      return;
    }

    document.getElementById("notes-owner-id").value = user.id;
    document.getElementById("create-owner-id").value = user.id;
    await loadNotes(user.id, "");
  } catch (error) {
    document.getElementById("notes-list").textContent = error.message;
  }
})();

document.getElementById("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  await loadNotes(formData.get("ownerId"), formData.get("search"));
});

document.getElementById("create-note-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const payload = {
    ownerId: formData.get("ownerId"),
    title: formData.get("title"),
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on"
  };

  await api("/api/notes", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadNotes(payload.ownerId, "");
  event.currentTarget.reset();
  document.getElementById("create-owner-id").value = payload.ownerId;
});
