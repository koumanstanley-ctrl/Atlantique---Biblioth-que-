
const pages = {
  dashboard: {
    title: "Tableau de bord",
    description: "Vue générale de votre bibliothèque."
  },
  books: {
    title: "Catalogue des livres",
    description: "Gestion des ouvrages et des exemplaires."
  },
  students: {
    title: "Lecteurs",
    description: "Gestion des élèves inscrits à la bibliothèque."
  },
  loans: {
    title: "Emprunts",
    description: "Suivi des livres empruntés."
  },
  returns: {
    title: "Retours",
    description: "Suivi des retours et des retards."
  },
  reports: {
    title: "Rapports",
    description: "Statistiques et activités de la bibliothèque."
  },
  settings: {
    title: "Paramètres",
    description: "Configuration de l'application."
  }
};

const title = document.getElementById("pageTitle");
const description = document.getElementById("pageDescription");
const pageContent = document.getElementById("pageContent");
const sidebar = document.getElementById("sidebar");

document.querySelectorAll(".nav-link[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    const selected = pages[page];

    if (!selected) return;

    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.remove("active");
    });

    button.classList.add("active");
    title.textContent = selected.title;
    description.textContent = selected.description;

    if (page !== "dashboard") {
      pageContent.innerHTML = `
        <div class="panel">
          <div class="welcome-box">
            <div class="welcome-icon">📚</div>
            <h2>${selected.title}</h2>
            <p>
              Ce module sera développé dans la prochaine étape
              du logiciel ATLANTIQUE BIBLIOTHÈQUE.
            </p>
          </div>
        </div>
      `;
    } else {
      location.reload();
    }

    sidebar.classList.remove("open");
  });
});

document.getElementById("menuToggle").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});
