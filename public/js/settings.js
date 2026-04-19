async function loadSettings(userId) {
  //cleint should not be able to control the settings of another user, therefore, remove encodeURIComponet(userID)
  const result = await api(`/api/settings`);
  const settings = result.settings;

  document.getElementById("settings-form-user-id").value = settings.userId;
  document.getElementById("settings-user-id").value = settings.userId;

  const form = document.getElementById("settings-form");
  form.elements.displayName.value = settings.displayName;
  form.elements.theme.value = settings.theme;
  form.elements.statusMessage.value = settings.statusMessage;
  form.elements.emailOptIn.checked = Boolean(settings.emailOptIn);
  //Vulnerability! InnerHTML without escaping. Attackers can input html code
  //document.getElementById("status-preview").innerHTML = `
   // <p><strong>${settings.displayName}</strong></p>
   // <p>${settings.statusMessage}</p>
 // `;

 //Fix

 //clear innerHTML
 const status_preview = document.getElementById("status-preview");
 status_preview.innerHTML = "";


 //generate template using textContent
  const displayNameP = document.createElement("p");
  const displayNameStrong = document.createElement("strong");
  const statusMessageP = document.createElement("p");
  displayNameStrong.textContent = settings.displayName;
  displayNameP.appendChild(displayNameStrong);
  statusMessageP.textContent = settings.statusMessage;

  //append to status_preview
  status_preview.appendChild(displayNameP);
  status_preview.appendChild(statusMessageP);

  writeJson("settings-output", settings);
}

(async function bootstrapSettings() {
  try {
    const user = await loadCurrentUser();

    if (!user) {
      writeJson("settings-output", { error: "Please log in first." });
      return;
    }

    await loadSettings(user.id);
  } catch (error) {
    writeJson("settings-output", { error: error.message });
  }
})();

document.getElementById("settings-query-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  await loadSettings(formData.get("userId"));
});

document.getElementById("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const payload = {
    userId: formData.get("userId"),
    displayName: formData.get("displayName"),
    theme: formData.get("theme"),
    statusMessage: formData.get("statusMessage"),
    emailOptIn: formData.get("emailOptIn") === "on"
  };

  const result = await api("/api/settings", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  writeJson("settings-output", result);
  await loadSettings(payload.userId);
});

document.getElementById("enable-email").addEventListener("click", async () => {
  const result = await api("/api/settings/toggle-email?enabled=1");
  writeJson("settings-output", result);
});

document.getElementById("disable-email").addEventListener("click", async () => {
  const result = await api("/api/settings/toggle-email?enabled=0");
  writeJson("settings-output", result);
});
