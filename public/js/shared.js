async function api(path, options = {}) {
  //Vulnerability! CSP should not be changable from the options
  //Also the user should not be able to input the method
  //Fixed
  //METHOD should only be GET or POST
  // GET should not have the ability to change the body
  if (options.method == "GET"){
    const csp= {
    method: "GET",
    headers:{
      "Content-Type": "application/json"
    },
    credentials: "same-origin"

  };
}
  //only if the method is POST is changing the body possible
  if (options.method == "POST"){
    csp.body == JSON.stringify(options.body || {});
  }
  const response = await fetch(path, csp);

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === "object" && body && body.error ? body.error : response.statusText;
    throw new Error(message);
  }

  return body;
}

async function loadCurrentUser() {
  const data = await api("/api/me");
  return data.user;
}

function writeJson(elementId, value) {
  const target = document.getElementById(elementId);

  if (target) {
    target.textContent = JSON.stringify(value, null, 2);
  }
}
