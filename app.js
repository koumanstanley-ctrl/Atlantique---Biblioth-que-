"use strict";

/* ATLANTIQUE BIBLIOTHÈQUE - Version 1.0
   Stockage local IndexedDB. Aucune synchronisation distante. */

const DB_NAME = "AtlantiqueBibliotheque";
const DB_VERSION = 1;
let db;
let currentForm = null;
let toastTimer;

const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => crypto.randomUUID
  ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const database = event.target.result;
      ["books", "readers", "loans"].forEach(name => {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, { keyPath: "id" });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function store(name, mode = "readonly") {
  return db.transaction(name, mode).objectStore(name);
}

function getAll(name) {
  return new Promise((resolve, reject) => {
    const request = store(name).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function saveRecord(name, record) {
  return new Promise((resolve, reject) => {
    const request = store(name, "readwrite").put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(name, id) {
  return new Promise((resolve, reject) => {
    const request = store(name, "readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function allData() {
  const [books, readers, loans] = await Promise.all([
    getAll("books"), getAll("readers"), getAll("loans")
  ]);
  return { books, readers, loans };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "—";
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function isLate(loan) {
  return !loan.returnDate && loan.dueDate < today();
}

function loanStatus(loan) {
  if (loan.returnDate) return ["Retourné", "badge-gray"];
  if (isLate(loan)) return ["En retard", "badge-orange"];
  return ["En cours", "badge-green"];
}

function showToast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2800);
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(item => item.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));

  const target = $("page-" + page);
  if (!target) return;
  target.classList.add("active");

  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add("active");

  $("page-title").textContent = ({
    dashboard: "Tableau de bord",
    books: "Catalogue des livres",
    readers: "Lecteurs",
    loans: "Emprunts et retours",
    reports: "Rapports",
    settings: "Paramètres"
  })[page] || "Bibliothèque";

  $("sidebar").classList.remove("open");
  refresh();
}

function availableCopies(book, loans) {
  const active = loans.filter(loan => loan.bookId === book.id && !loan.returnDate).length;
  return Math.max(0, Number(book.copies || 0) - active);
}

async function refresh() {
  const { books, readers, loans } = await allData();
  const active = loans.filter(loan => !loan.returnDate);
  const late = active.filter(isLate);
  const totalCopies = books.reduce((sum, book) => sum + Number(book.copies || 0), 0);
  const available = books.reduce((sum, book) => sum + availableCopies(book, loans), 0);

  $("stat-copies").textContent = totalCopies;
  $("stat-available").textContent = available;
  $("stat-readers").textContent = readers.length;
  $("stat-active").textContent = active.length;
  $("stat-late-label").textContent = `${late.length} en retard`;

  $("report-total").textContent = loans.length;
  $("report-returned").textContent = loans.filter(loan => loan.returnDate).length;
  $("report-active").textContent = active.length;
  $("report-late").textContent = late.length;

  renderBooks(books, loans);
  renderReaders(readers);
  renderLoans(books, readers, loans);
  renderRecent(books, readers, loans);
  renderCollection(books, loans);
  $("storage-info").textContent =
    `Stockage local actif · ${books.length} livre(s) · ${readers.length} lecteur(s) · ${loans.length} emprunt(s)`;
}

function renderBooks(books, loans) {
  const query = ($("book-search").value || "").toLowerCase();
  const filtered = books.filter(book =>
    [book.title, book.author, book.category, book.isbn]
      .join(" ").toLowerCase().includes(query)
  );

  $("books-count").textContent = `${filtered.length} livre(s)`;
  $("books-table").innerHTML = filtered.length ? filtered.map(book => `
    <tr>
      <td><b>${escapeHTML(book.title)}</b></td>
      <td>${escapeHTML(book.author)}</td>
      <td>${escapeHTML(book.category)}</td>
      <td>${escapeHTML(book.isbn || "—")}</td>
      <td>${Number(book.copies)}</td>
      <td><span class="badge ${availableCopies(book, loans) ? "badge-green" : "badge-orange"}">${availableCopies(book, loans)}</span></td>
      <td><div class="row-actions">
        <button class="mini-btn" data-edit="book" data-id="${book.id}">Modifier</button>
        <button class="mini-btn delete" data-delete="book" data-id="${book.id}">Supprimer</button>
      </div></td>
    </tr>`).join("") : `<tr><td colspan="7" class="empty">Aucun livre trouvé.</td></tr>`;
}

function renderReaders(readers) {
  const query = ($("reader-search").value || "").toLowerCase();
  const filtered = readers.filter(reader =>
    [reader.name, reader.matricule, reader.className, reader.contact]
      .join(" ").toLowerCase().includes(query)
  );

  $("readers-count").textContent = `${filtered.length} lecteur(s)`;
  $("readers-table").innerHTML = filtered.length ? filtered.map(reader => `
    <tr>
      <td><b>${escapeHTML(reader.name)}</b></td>
      <td>${escapeHTML(reader.matricule || "—")}</td>
      <td>${escapeHTML(reader.className)}</td>
      <td>${escapeHTML(reader.contact || "—")}</td>
      <td><div class="row-actions">
        <button class="mini-btn" data-edit="reader" data-id="${reader.id}">Modifier</button>
        <button class="mini-btn delete" data-delete="reader" data-id="${reader.id}">Supprimer</button>
      </div></td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty">Aucun lecteur trouvé.</td></tr>`;
}

function renderLoans(books, readers, loans) {
  const bookMap = Object.fromEntries(books.map(book => [book.id, book]));
  const readerMap = Object.fromEntries(readers.map(reader => [reader.id, reader]));
  const query = ($("loan-search").value || "").toLowerCase();
  const filter = $("loan-filter").value;

  const filtered = loans.filter(loan => {
    const book = bookMap[loan.bookId];
    const reader = readerMap[loan.readerId];
    const text = `${book?.title || ""} ${reader?.name || ""}`.toLowerCase();
    const matchesSearch = text.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "returned" && !!loan.returnDate) ||
      (filter === "active" && !loan.returnDate) ||
      (filter === "late" && isLate(loan));
    return matchesSearch && matchesFilter;
  }).sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));

  $("loans-table").innerHTML = filtered.length ? filtered.map(loan => {
    const [status, badge] = loanStatus(loan);
    return `<tr>
      <td><b>${escapeHTML(bookMap[loan.bookId]?.title || "Livre supprimé")}</b></td>
      <td>${escapeHTML(readerMap[loan.readerId]?.name || "Lecteur supprimé")}</td>
      <td>${formatDate(loan.borrowDate)}</td>
      <td>${formatDate(loan.dueDate)}</td>
      <td>${formatDate(loan.returnDate)}</td>
      <td><span class="badge ${badge}">${status}</span></td>
      <td>${!loan.returnDate
        ? `<button class="mini-btn" data-return="${loan.id}">Enregistrer le retour</button>`
        : "—"}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="7" class="empty">Aucun emprunt trouvé.</td></tr>`;
}

function renderRecent(books, readers, loans) {
  const bookMap = Object.fromEntries(books.map(book => [book.id, book]));
  const readerMap = Object.fromEntries(readers.map(reader => [reader.id, reader]));
  const recent = [...loans].sort((a, b) =>
    b.borrowDate.localeCompare(a.borrowDate)
  ).slice(0, 5);

  $("recent-table").innerHTML = recent.length ? recent.map(loan => {
    const [status, badge] = loanStatus(loan);
    return `<tr>
      <td>${escapeHTML(bookMap[loan.bookId]?.title || "Livre supprimé")}</td>
      <td>${escapeHTML(readerMap[loan.readerId]?.name || "Lecteur supprimé")}</td>
      <td>${formatDate(loan.dueDate)}</td>
      <td><span class="badge ${badge}">${status}</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="4" class="empty">Aucun emprunt enregistré.</td></tr>`;
}

function renderCollection(books, loans) {
  const container = $("collection-report");
  if (!books.length) {
    container.innerHTML = `<p class="empty">Ajoutez des livres pour afficher le rapport.</p>`;
    return;
  }

  const categories = {};
  books.forEach(book => {
    const category = book.category || "Non classé";
    categories[category] = (categories[category] || 0) + Number(book.copies || 0);
  });

  const max = Math.max(1, ...Object.values(categories));
  container.innerHTML = Object.entries(categories).map(([name, total]) => `
    <div class="report-row">
      <span>${escapeHTML(name)}</span>
      <div class="bar"><span style="width:${total / max * 100}%"></span></div>
      <b>${total}</b>
    </div>`).join("");
}

/* Formulaires */

function openModal(title, fields, submitHandler) {
  $("modal-title").textContent = title;
  $("form-fields").innerHTML = fields;
  currentForm = submitHandler;
  $("modal-layer").classList.add("open");
}

function closeModal() {
  $("modal-layer").classList.remove("open");
  $("record-form").reset();
  currentForm = null;
}

function inputField(label, name, type = "text", value = "", required = true, full = false) {
  return `<div class="field ${full ? "full" : ""}">
    <label for="field-${name}">${label}</label>
    <input id="field-${name}" name="${name}" type="${type}"
      value="${escapeHTML(value)}" ${required ? "required" : ""}
      ${type === "number" ? 'min="1"' : ""}>
  </div>`;
}

function selectField(label, name, options, required = true, full = false) {
  return `<div class="field ${full ? "full" : ""}">
    <label for="field-${name}">${label}</label>
    <select id="field-${name}" name="${name}" ${required ? "required" : ""}>
      ${options}
    </select>
  </div>`;
}

async function newBook(existing = null) {
  const book = existing || {};
  const fields =
    inputField("Titre du livre", "title", "text", book.title || "", true, true) +
    inputField("Auteur", "author", "text", book.author || "") +
    inputField("Catégorie", "category", "text", book.category || "") +
    inputField("ISBN (facultatif)", "isbn", "text", book.isbn || "", false) +
    inputField("Nombre d'exemplaires", "copies", "number", book.copies ?? 1);

  openModal(existing ? "Modifier le livre" : "Ajouter un livre", fields, async data => {
    const copies = Number(data.copies);
    if (!Number.isInteger(copies) || copies < 1) throw new Error("Le nombre d'exemplaires doit être au moins égal à 1.");

    const loans = await getAll("loans");
    const activeCount = existing
      ? loans.filter(loan => loan.bookId === existing.id && !loan.returnDate).length
      : 0;

    if (copies < activeCount) {
      throw new Error(`Impossible : ${activeCount} exemplaire(s) sont actuellement empruntés.`);
    }

    await saveRecord("books", {
      id: existing?.id || makeId(),
      title: data.title.trim(),
      author: data.author.trim(),
      category: data.category.trim(),
      isbn: data.isbn.trim(),
      copies
    });
    closeModal();
    await refresh();
    showToast(existing ? "Livre modifié." : "Livre ajouté au catalogue.");
  });
}

async function newReader(existing = null) {
  const reader = existing || {};
  const fields =
    inputField("Nom complet", "name", "text", reader.name || "", true, true) +
    inputField("Matricule", "matricule", "text", reader.matricule || "", false) +
    inputField("Classe", "className", "text", reader.className || "") +
    inputField("Contact (facultatif)", "contact", "text", reader.contact || "", false, true);

  openModal(existing ? "Modifier le lecteur" : "Inscrire un lecteur", fields, async data => {
    const readers = await getAll("readers");
    const duplicate = readers.find(reader =>
      reader.id !== existing?.id &&
      data.matricule.trim() &&
      reader.matricule.toLowerCase() === data.matricule.trim().toLowerCase()
    );
    if (duplicate) throw new Error("Ce matricule est déjà enregistré.");

    await saveRecord("readers", {
      id: existing?.id || makeId(),
      name: data.name.trim(),
      matricule: data.matricule.trim(),
      className: data.className.trim(),
      contact: data.contact.trim()
    });
    closeModal();
    await refresh();
    showToast(existing ? "Lecteur modifié." : "Lecteur ajouté.");
  });
}

async function newLoan() {
  const { books, readers, loans } = await allData();
  const availableBooks = books.filter(book => availableCopies(book, loans) > 0);

  if (!availableBooks.length) {
    showToast("Aucun exemplaire disponible. Ajoutez un livre ou enregistrez un retour.");
    return;
  }
  if (!readers.length) {
    showToast("Inscrivez d'abord un lecteur.");
    return;
  }

  const bookOptions = availableBooks.map(book =>
    `<option value="${book.id}">${escapeHTML(book.title)} — ${availableCopies(book, loans)} disponible(s)</option>`
  ).join("");
  const readerOptions = readers.map(reader =>
    `<option value="${reader.id}">${escapeHTML(reader.name)} — ${escapeHTML(reader.className)}</option>`
  ).join("");

  const fields =
    selectField("Livre à emprunter", "bookId", bookOptions, true, true) +
    selectField("Lecteur", "readerId", readerOptions, true, true) +
    inputField("Date d'emprunt", "borrowDate", "date", today()) +
    inputField("Date limite de retour", "dueDate", "date",
      new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

  openModal("Enregistrer un emprunt", fields, async data => {
    if (data.dueDate < data.borrowDate) {
      throw new Error("La date limite ne peut pas précéder la date d'emprunt.");
    }

    const currentBooks = await getAll("books");
    const currentLoans = await getAll("loans");
    const selectedBook = currentBooks.find(book => book.id === data.bookId);
    if (!selectedBook || availableCopies(selectedBook, currentLoans) < 1) {
      throw new Error("Cet exemplaire n'est plus disponible.");
    }

    await saveRecord("loans", {
      id: makeId(),
      bookId: data.bookId,
      readerId: data.readerId,
      borrowDate: data.borrowDate,
      dueDate: data.dueDate,
      returnDate: ""
    });

    closeModal();
    await refresh();
    showToast("Emprunt enregistré.");
  });
}

async function editRecord(type, id) {
  const record = await new Promise((resolve, reject) => {
    const request = store(type === "book" ? "books" : "readers").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!record) return;
  if (type === "book") newBook(record);
  else newReader(record);
}

/* Actions de suppression et retour */

async function removeRecord(type, id) {
  if (type === "book") {
    const loans = await getAll("loans");
    if (loans.some(loan => loan.bookId === id && !loan.returnDate)) {
      showToast("Ce livre possède un emprunt en cours.");
      return;
    }
    if (!confirm("Supprimer ce livre du catalogue ?")) return;
    await deleteRecord("books", id);
  } else {
    const loans = await getAll("loans");
    if (loans.some(loan => loan.readerId === id && !loan.returnDate)) {
      showToast("Ce lecteur possède un emprunt en cours.");
      return;
    }
    if (!confirm("Supprimer ce lecteur ? L'historique des emprunts sera conservé.")) return;
    await deleteRecord("readers", id);
  }
  await refresh();
  showToast("Suppression effectuée.");
}

async function returnLoan(id) {
  const loans = await getAll("loans");
  const loan = loans.find(item => item.id === id);
  if (!loan || loan.returnDate) return;
  if (!confirm("Confirmer le retour de ce livre aujourd'hui ?")) return;

  loan.returnDate = today();
  await saveRecord("loans", loan);
  await refresh();
  showToast("Retour enregistré. Exemplaire disponible.");
}

/* Sauvegarde et restauration */

async function exportBackup() {
  const data = await allData();
  const backup = {
    application: "ATLANTIQUE BIBLIOTHÈQUE",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sauvegarde-atlantique-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Sauvegarde téléchargée.");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.books) ||
        !Array.isArray(parsed.readers) ||
        !Array.isArray(parsed.loans)) {
      throw new Error("Le fichier ne correspond pas à une sauvegarde valide.");
    }

    const bookIds = new Set(parsed.books.map(item => item.id));
    const readerIds = new Set(parsed.readers.map(item => item.id));

    for (const loan of parsed.loans) {
      if (!loan.id || !bookIds.has(loan.bookId) || !readerIds.has(loan.readerId)) {
        throw new Error("La sauvegarde contient un emprunt incomplet ou invalide.");
      }
    }

    if (!confirm("La restauration remplacera toutes les données actuelles. Continuer ?")) return;

    const transaction = db.transaction(["books", "readers", "loans"], "readwrite");
    for (const name of ["books", "readers", "loans"]) {
      transaction.objectStore(name).clear();
    }
    parsed.books.forEach(item => transaction.objectStore("books").put(item));
    parsed.readers.forEach(item => transaction.objectStore("readers").put(item));
    parsed.loans.forEach(item => transaction.objectStore("loans").put(item));

    transaction.oncomplete = async () => {
      await refresh();
      showToast("Sauvegarde restaurée.");
    };
    transaction.onerror = () => showToast("Erreur pendant la restauration.");
  } catch (error) {
    showToast(error.message || "Fichier de sauvegarde invalide.");
  } finally {
    $("import-file").value = "";
  }
}

async function resetApplication() {
  if (!confirm("ATTENTION : toutes les données locales seront supprimées. Continuer ?")) return;
  if (!confirm("Dernière confirmation : avez-vous téléchargé une sauvegarde ?")) return;

  const transaction = db.transaction(["books", "readers", "loans"], "readwrite");
  ["books", "readers", "loans"].forEach(name => transaction.objectStore(name).clear());
  transaction.oncomplete = async () => {
    await refresh();
    showToast("Les données locales ont été réinitialisées.");
  };
}

/* Événements */

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.addEventListener("click", event => {
  const action = event.target.closest("[data-action]");
  const goto = event.target.closest("[data-goto]");
  const viewLink = event.target.closest("[data-goto]");
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");
  const returnButton = event.target.closest("[data-return]");

  if (action) {
    if (action.dataset.action === "new-book") newBook();
    if (action.dataset.action === "new-reader") newReader();
    if (action.dataset.action === "new-loan") newLoan();
  }
  if (goto || viewLink) showPage((goto || viewLink).dataset.goto);
  if (edit) editRecord(edit.dataset.edit, edit.dataset.id);
  if (remove) removeRecord(remove.dataset.delete, remove.dataset.id);
  if (returnButton) returnLoan(returnButton.dataset.return);
});

$("record-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentForm) return;
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await currentForm(data);
  } catch (error) {
    showToast(error.message || "Une erreur est survenue.");
  }
});

$("close-modal").addEventListener("click", closeModal);
$("cancel-modal").addEventListener("click", closeModal);
$("modal-layer").addEventListener("click", event => {
  if (event.target === $("modal-layer")) closeModal();
});

["book-search", "reader-search", "loan-search"].forEach(id => {
  $(id).addEventListener("input", refresh);
});
$("loan-filter").addEventListener("change", refresh);

$("menu-toggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("export-btn").addEventListener("click", exportBackup);
$("import-file").addEventListener("change", event => importBackup(event.target.files[0]));
$("reset-btn").addEventListener("click", resetApplication);

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.goto));
});

function updateNetworkStatus() {
  $("network-status").textContent = navigator.onLine
    ? "Connexion disponible"
    : "Mode hors connexion";
}
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

async function startApp() {
  try {
    db = await openDatabase();
    updateNetworkStatus();
    await refresh();

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./service-worker.js")
        .catch(error => console.warn("Service worker non enregistré :", error));
    }
  } catch (error) {
    console.error(error);
    showToast("Impossible d'ouvrir le stockage local. Vérifiez votre navigateur.");
  }
}

startApp();
