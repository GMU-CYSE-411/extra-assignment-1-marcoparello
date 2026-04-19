
// FIXED SESSION!------------------------------------------------
//No regeneration of session. Implicitly trusts the client side. An attacker could intercept the session after login as a result, and not need validation
(function setupFixationHelper() {
  // regeneation of session was made on server side. Therefore, I will make this helper a function that looks for old sid parameters and deletes them
  const params = new URLSearchParams(window.location.search);
  if (params.has("sid")){
    params.delete("sid");
    //replaces the fixed session from the URL
    window.history.replaceState({}, "", window.location.pathname);
  }
  //const fixedSession = params.get("sid");

  //Never set cookies from a fixed session
  //if (fixedSession) {
    //document.cookie = `sid=${fixedSession}; path=/`;
  //}
})();
// -----------------------------------------------------------------
document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    writeJson("login-output", result);
  } catch (error) {
    writeJson("login-output", { error: error.message });
  }
});
