// ---------- Elements and data ----------
const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusMessage = document.getElementById("status");
const usersList = document.getElementById("users-list");

// Every user loaded from the API. The filter works on this array,
// so typing in the filter box never makes a new request.
let users = [];

// ---------- Rendering ----------
// Draws any array of users. User text only goes in through textContent.
function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No users match your filter.";
    usersList.appendChild(empty);
    return;
  }

  for (const user of list) {
    const item = document.createElement("li");

    const name = document.createElement("strong");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    item.append(name, email, city, company);
    usersList.appendChild(item);
  }
}

// ---------- Filtering ----------
// Keeps users whose name includes the typed text (ignoring upper and lower case).
function applyFilter() {
  const text = filterInput.value.trim().toLowerCase();
  const matches = users.filter((user) => user.name.toLowerCase().includes(text));
  renderUsers(matches);
}

// ---------- Loading ----------
async function loadUsers() {
  loadButton.disabled = true;
  statusMessage.textContent = "Loading users...";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`The server replied with status ${response.status}`);
    }

    users = await response.json();
    applyFilter(); // shows everyone, or only matches if a filter is already typed
    statusMessage.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    users = [];
    usersList.replaceChildren();
    statusMessage.textContent = `Could not load users. ${error.message}. Please try again.`;
  } finally {
    loadButton.disabled = false;
  }
}

// ---------- Events ----------
loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  // Nothing to filter until users have been loaded
  if (users.length > 0) {
    applyFilter();
  }
});
