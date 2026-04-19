(async function bootstrapAdmin() {
  try {
    const user = await loadCurrentUser();

    if (!user) {
      document.getElementById("admin-warning").textContent = "Please log in first.";
      return;
    }

    if (user.role !== "admin") {
      document.getElementById("admin-warning").textContent =
        "The client says this is not your area, but the page still tries to load admin data.";
    } else {
      document.getElementById("admin-warning").textContent = "Authenticated as admin.";
    }

    const result = await api("/api/admin/users");
    //Vulnerability! Remove innerHTML
    //document.getElementById("admin-users").innerHTML = result.users
      //.map(
      //  (entry) => `
      //    <tr>
       //     <td>${entry.id}</td>
       //     <td>${entry.username}</td>
       //     <td>${entry.role}</td>
        //    <td>${entry.displayName}</td>
        //    <td>${entry.noteCount}</td>
      //    </tr>
     //   `
     // )
     // .join("");
     
     //Generate manually
     const admin_users = document.getElementById("admin-users");
     //clear 
     admin_users.textContent = "";

     for (const entry of result.users){
      const admin_users_tr = document.createElement("tr");
      const admin_users_id = document.createElement("td");
      admin_users_id.textContent = entry.id;
      const admin_users_username = document.createElement("td");
      admin_users_username.textContent = entry.username;
      const admin_users_role = document.createElement("td");
      admin_users_role.textContent = entry.role;
      const admin_users_displayName = document.createElement("td");
      admin_users_displayName.textContent = entry.displayName;
      const admin_users_noteCount = document.createElement("td");
      admin_users_noteCount.textContent = entry.noteCount;
      admin_users_tr.appendChild(admin_users_id);
      admin_users_tr.appendChild(admin_users_username);
      admin_users_tr.appendChild(admin_users_role);
      admin_users_tr.appendChild(admin_users_displayName);
      admin_users_tr.appendChild(admin_users_noteCount);
      admin_users.appendChild(admin_users_tr);
     }
  } catch (error) {
    document.getElementById("admin-warning").textContent = error.message;
  }
})();
