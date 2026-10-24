/* =========================================================
   Peshawar BRT Lost & Found Management System
   Vanilla JS + LocalStorage prototype
   ========================================================= */

/* ---------------- GLOBAL STATE ---------------- */
let reports = [];   // all lost + found reports
let claims = [];    // all claims

const STORAGE_KEY_REPORTS = "brt_reports";
const STORAGE_KEY_CLAIMS = "brt_claims";

const CATEGORIES = ["Mobile", "Wallet", "Bag", "Documents", "Keys", "Electronics", "Other"];

/* =========================================================
   1. LOCAL STORAGE  (loadData / saveData)
   ========================================================= */
function loadData() {
  const savedReports = localStorage.getItem(STORAGE_KEY_REPORTS);
  const savedClaims = localStorage.getItem(STORAGE_KEY_CLAIMS);
  reports = savedReports ? JSON.parse(savedReports) : [];
  claims = savedClaims ? JSON.parse(savedClaims) : [];
}

function saveData() {
  localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));
  localStorage.setItem(STORAGE_KEY_CLAIMS, JSON.stringify(claims));
}

/* =========================================================
   2. REPORT ID GENERATION
   ========================================================= */
function generateReportId(type) {
  const prefix = type === "lost" ? "LR" : "FR";
  const countOfType = reports.filter(r => r.type === type).length + 1;
  return `${prefix}-${String(countOfType).padStart(3, "0")}`;
}

/* =========================================================
   3. FORM VALIDATION
   ========================================================= */
function validateForm(formEl, requiredFields) {
  let isValid = true;
  const data = {};

  requiredFields.forEach(name => {
    const el = formEl.elements[name];
    if (!el) return;
    const value = el.value.trim();
    el.classList.remove("error");

    if (!value) {
      el.classList.add("error");
      isValid = false;
    }
    data[name] = value;
  });

  // collect the rest of the non-required fields too
  Array.from(formEl.elements).forEach(el => {
    if (el.name && !(el.name in data)) data[el.name] = el.value ? el.value.trim() : "";
  });

  // contact number check (7-15 digits, optional leading +)
  const contactField = formEl.elements["contactNumber"];
  if (contactField) {
    const digits = contactField.value.trim();
    const phoneOk = /^\+?\d{7,15}$/.test(digits);
    if (digits && !phoneOk) {
      contactField.classList.add("error");
      isValid = false;
    }
  }

  return { isValid, data };
}

function showFormMsg(el, text, type) {
  el.textContent = text;
  el.className = "form-msg " + type;
}

/* =========================================================
   4. IMAGE HANDLING (optional image -> base64 preview)
   ========================================================= */
function readImageAsDataUrl(fileInput, previewEl, callback) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) { callback(null); return; }
  const reader = new FileReader();
  reader.onload = e => {
    previewEl.src = e.target.result;
    previewEl.classList.remove("hidden");
    callback(e.target.result);
  };
  reader.readAsDataURL(file);
}

/* =========================================================
   5. ADD LOST / FOUND ITEM
   ========================================================= */
function addLostItem(data, imageData) {
  const report = {
    id: generateReportId("lost"),
    type: "lost",
    itemName: data.itemName,
    category: data.category,
    description: data.description,
    color: data.color,
    brand: data.brand || "",
    station: data.station,
    date: data.date,
    time: data.time || "",
    contactName: data.contactName,
    contactNumber: data.contactNumber,
    image: imageData || null,
    status: "Lost",
    createdAt: Date.now()
  };
  reports.push(report);
  saveData();
  return report;
}

function addFoundItem(data, imageData) {
  const report = {
    id: generateReportId("found"),
    type: "found",
    itemName: data.itemName,
    category: data.category,
    description: data.description,
    color: data.color,
    brand: data.brand || "",
    station: data.station,
    date: data.date,
    time: data.time || "",
    contactName: data.contactName,
    contactNumber: data.contactNumber,
    image: imageData || null,
    status: "Found",
    createdAt: Date.now()
  };
  reports.push(report);
  saveData();
  return report;
}

/* =========================================================
   6. POSSIBLE MATCH ALGORITHM
   ========================================================= */
function findPossibleMatches(lostReport) {
  const foundReports = reports.filter(r => r.type === "found");

  const scored = foundReports.map(found => {
    let score = 0;
    if (norm(found.itemName) === norm(lostReport.itemName)) score++;
    if (norm(found.category) === norm(lostReport.category)) score++;
    if (norm(found.color) === norm(lostReport.color)) score++;
    if (norm(found.station) === norm(lostReport.station)) score++;
    if (found.date === lostReport.date) score++;
    return { report: found, score };
  });

  return scored
    .filter(s => s.score >= 3)
    .sort((a, b) => b.score - a.score);
}

function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}

/* =========================================================
   7. DISPLAY / SEARCH / FILTER
   ========================================================= */
function searchReports(query, list) {
  const q = norm(query);
  if (!q) return list;
  return list.filter(r =>
    norm(r.itemName).includes(q) || norm(r.description).includes(q)
  );
}

function filterReports({ type, category, station, sort } = {}) {
  let list = [...reports];

  if (type && type !== "all") list = list.filter(r => r.type === type);
  if (category) list = list.filter(r => r.category === category);
  if (station) list = list.filter(r => norm(r.station).includes(norm(station)));

  const searchVal = document.getElementById("searchInput")?.value || "";
  list = searchReports(searchVal, list);

  list.sort((a, b) => sort === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);

  return list;
}

function statusBadgeClass(status) {
  switch (status) {
    case "Lost": return "badge-lost";
    case "Found": return "badge-found";
    case "Claimed": return "badge-claimed";
    case "Verified": return "badge-verified";
    case "Returned": return "badge-returned";
    default: return "badge-found";
  }
}

function buildCard(report, options = {}) {
  const card = document.createElement("div");
  card.className = "item-card";
  card.dataset.id = report.id;

  const img = report.image ? `<img class="card-thumb" src="${report.image}" alt="${escapeHtml(report.itemName)}">` : "";

  card.innerHTML = `
    ${img}
    <span class="badge ${statusBadgeClass(report.status)}">${report.status}</span>
    <h3>${escapeHtml(report.itemName)}</h3>
    <div class="meta">${escapeHtml(report.category)} • ${escapeHtml(report.station)}</div>
    <div class="meta">${report.date || ""} · ${report.id}</div>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.closest("[data-manage-action]")) return;
    showItemDetails(report.id);
  });

  if (options.manageMode) {
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.innerHTML = `
      <button class="btn btn-small btn-outline" data-manage-action="edit">Edit</button>
      <button class="btn btn-small btn-danger" data-manage-action="delete">Delete</button>
      ${report.status !== "Returned" ? `<button class="btn btn-small btn-secondary" data-manage-action="return">Mark Returned</button>` : ""}
    `;
    actions.querySelector('[data-manage-action="edit"]').addEventListener("click", (e) => { e.stopPropagation(); openEditModal(report.id); });
    actions.querySelector('[data-manage-action="delete"]').addEventListener("click", (e) => { e.stopPropagation(); deleteReport(report.id); });
    const returnBtn = actions.querySelector('[data-manage-action="return"]');
    if (returnBtn) returnBtn.addEventListener("click", (e) => { e.stopPropagation(); updateStatus(report.id, "Returned"); refreshAllViews(); });
    card.appendChild(actions);
  }

  return card;
}

function displayReports(list, containerEl, options = {}) {
  containerEl.innerHTML = "";
  if (!list.length) {
    containerEl.innerHTML = `<p class="empty-msg">No reports yet.</p>`;
    return;
  }
  list.forEach(r => containerEl.appendChild(buildCard(r, options)));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* =========================================================
   8. ITEM DETAILS + MATCHING DISPLAY
   ========================================================= */
function showItemDetails(id) {
  const report = reports.find(r => r.id === id);
  if (!report) return;

  const content = document.getElementById("detailsContent");
  let matchHtml = "";

  if (report.type === "lost") {
    const matches = findPossibleMatches(report);
    if (matches.length) {
      const best = matches[0];
      matchHtml = `<div class="match-box">✅ Possible Match Found — ${best.score}/5 details match (Found report ${best.report.id})</div>`;
    } else {
      matchHtml = `<div class="match-box" style="background:#f0f0f0;color:#555;">No possible match yet. Check back later.</div>`;
    }
  }

  content.innerHTML = `
    <h2>${escapeHtml(report.itemName)}</h2>
    ${report.image ? `<img class="image-preview" style="max-width:100%;max-height:220px;object-fit:cover;" src="${report.image}" alt="">` : ""}
    <div class="detail-row"><span>Report ID</span><span>${report.id}</span></div>
    <div class="detail-row"><span>Type</span><span>${report.type === "lost" ? "Lost Item" : "Found Item"}</span></div>
    <div class="detail-row"><span>Category</span><span>${escapeHtml(report.category)}</span></div>
    <div class="detail-row"><span>Description</span><span>${escapeHtml(report.description)}</span></div>
    <div class="detail-row"><span>Color</span><span>${escapeHtml(report.color)}</span></div>
    <div class="detail-row"><span>Brand</span><span>${escapeHtml(report.brand) || "—"}</span></div>
    <div class="detail-row"><span>Station / Route</span><span>${escapeHtml(report.station)}</span></div>
    <div class="detail-row"><span>Date</span><span>${report.date}${report.time ? " · " + report.time : ""}</span></div>
    <div class="detail-row"><span>Status</span><span><span class="badge ${statusBadgeClass(report.status)}">${report.status}</span></span></div>
    ${matchHtml}
    <div class="detail-actions">
      ${report.status === "Lost" || report.status === "Found" ? `<button class="btn btn-primary" id="openClaimBtn">Claim This Item</button>` : ""}
    </div>
  `;

  const claimBtn = document.getElementById("openClaimBtn");
  if (claimBtn) claimBtn.addEventListener("click", () => {
    closeModal("detailsModal");
    openClaimModal(report.id);
  });

  openModal("detailsModal");
}

/* =========================================================
   9. CLAIM & RETURN FLOW
   ========================================================= */
function openClaimModal(reportId) {
  document.getElementById("claimReportId").value = reportId;
  document.getElementById("claimReportIdDisplay").value = reportId;
  document.getElementById("claimForm").reset();
  document.getElementById("claimReportId").value = reportId;
  document.getElementById("claimReportIdDisplay").value = reportId;
  document.getElementById("claimFormMsg").textContent = "";
  openModal("claimModal");
}

function submitClaim(reportId, claimData) {
  const claim = {
    id: "CL-" + String(claims.length + 1).padStart(3, "0"),
    reportId,
    ownerName: claimData.ownerName,
    contactNumber: claimData.contactNumber,
    identifyingDetail: claimData.identifyingDetail,
    date: new Date().toISOString().slice(0, 10),
    status: "Pending"
  };
  claims.push(claim);
  updateStatus(reportId, "Claimed");
  saveData();
  return claim;
}

function updateStatus(reportId, newStatus) {
  const report = reports.find(r => r.id === reportId);
  if (!report) return;
  report.status = newStatus;
  saveData();
}

/* =========================================================
   10. EDIT / DELETE
   ========================================================= */
const EDIT_FIELD_DEFS = [
  { name: "itemName", label: "Item Name", type: "text" },
  { name: "category", label: "Category", type: "select" },
  { name: "description", label: "Description", type: "textarea", full: true },
  { name: "color", label: "Color", type: "text" },
  { name: "brand", label: "Brand", type: "text" },
  { name: "station", label: "BRT Station / Route", type: "text" },
  { name: "date", label: "Date", type: "date" },
  { name: "time", label: "Approximate Time", type: "time" },
  { name: "contactName", label: "Contact Name", type: "text" },
  { name: "contactNumber", label: "Contact Number", type: "tel" }
];

function openEditModal(id) {
  const report = reports.find(r => r.id === id);
  if (!report) return;

  document.getElementById("editReportId").value = id;
  const fieldsEl = document.getElementById("editFormFields");
  fieldsEl.innerHTML = "";

  EDIT_FIELD_DEFS.forEach(def => {
    const wrap = document.createElement("div");
    wrap.className = "field" + (def.full ? " full" : "");
    let inputHtml;
    if (def.type === "select") {
      inputHtml = `<select name="${def.name}">${CATEGORIES.map(c => `<option ${c === report[def.name] ? "selected" : ""}>${c}</option>`).join("")}</select>`;
    } else if (def.type === "textarea") {
      inputHtml = `<textarea name="${def.name}" rows="3">${escapeHtml(report[def.name])}</textarea>`;
    } else {
      inputHtml = `<input type="${def.type}" name="${def.name}" value="${escapeHtml(report[def.name])}">`;
    }
    wrap.innerHTML = `<label>${def.label}</label>${inputHtml}`;
    fieldsEl.appendChild(wrap);
  });

  document.getElementById("editFormMsg").textContent = "";
  openModal("editModal");
}

function editReport(id, updatedFields) {
  const report = reports.find(r => r.id === id);
  if (!report) return;
  Object.assign(report, updatedFields);
  saveData();
}

function deleteReport(id) {
  const confirmed = confirm("Are you sure you want to delete this report? This cannot be undone.");
  if (!confirmed) return;
  reports = reports.filter(r => r.id !== id);
  claims = claims.filter(c => c.reportId !== id);
  saveData();
  refreshAllViews();
  showToast("Report deleted.");
}

/* =========================================================
   11. STATS
   ========================================================= */
function updateStats() {
  const totalLost = reports.filter(r => r.type === "lost").length;
  const totalFound = reports.filter(r => r.type === "found").length;
  const returned = reports.filter(r => r.status === "Returned").length;
  const possibleMatches = reports
    .filter(r => r.type === "lost" && r.status !== "Returned")
    .filter(r => findPossibleMatches(r).length > 0).length;

  document.getElementById("statLost").textContent = totalLost;
  document.getElementById("statFound").textContent = totalFound;
  document.getElementById("statMatches").textContent = possibleMatches;
  document.getElementById("statReturned").textContent = returned;
}

/* =========================================================
   12. VIEW / NAVIGATION
   ========================================================= */
function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(viewId)?.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });

  document.querySelector(".nav-links")?.classList.remove("open");

  if (viewId === "search") renderSearchView();
  if (viewId === "my-reports") renderManageView();
  if (viewId === "dashboard") renderDashboard();
}

function refreshAllViews() {
  updateStats();
  renderDashboard();
  renderSearchView();
  renderManageView();
}

function renderDashboard() {
  updateStats();
  const recent = [...reports].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  displayReports(recent, document.getElementById("recentReports"));
}

function renderSearchView() {
  const list = filterReports({
    type: document.getElementById("filterType").value,
    category: document.getElementById("filterCategory").value,
    station: document.getElementById("filterStation").value,
    sort: document.getElementById("sortOrder").value
  });
  const container = document.getElementById("searchResults");
  const noResults = document.getElementById("noResultsMsg");
  displayReports(list, container);
  noResults.classList.toggle("hidden", list.length > 0);
}

function renderManageView() {
  const list = [...reports].sort((a, b) => b.createdAt - a.createdAt);
  displayReports(list, document.getElementById("manageReports"), { manageMode: true });
}

/* =========================================================
   13. MODALS / TOAST
   ========================================================= */
function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2600);
}

/* =========================================================
   14. DEMO SAMPLE DATA (bonus)
   ========================================================= */
function loadSampleData() {
  const sampleLost = {
    itemName: "iPhone 13", category: "Mobile", description: "Black iPhone with a cracked corner, blue cover",
    color: "Black", brand: "Apple", station: "University Road Station", date: "2026-09-10", time: "17:30",
    contactName: "Ahmad Raza", contactNumber: "03001234567"
  };
  const sampleFound = {
    itemName: "iPhone 13", category: "Mobile", description: "Black phone with blue case found on seat",
    color: "Black", brand: "Apple", station: "University Road Station", date: "2026-09-10", time: "17:45",
    contactName: "Bilal Khan", contactNumber: "03009876543"
  };
  const sampleLost2 = {
    itemName: "Leather Wallet", category: "Wallet", description: "Brown leather wallet with ID cards",
    color: "Brown", brand: "", station: "Chamkani Station", date: "2026-09-12", time: "",
    contactName: "Sara Ali", contactNumber: "03111234567"
  };
  addLostItem(sampleLost, null);
  addFoundItem(sampleFound, null);
  addLostItem(sampleLost2, null);
  saveData();
  refreshAllViews();
  showToast("Demo data loaded.");
}

/* =========================================================
   15. DARK MODE (bonus)
   ========================================================= */
function initDarkMode() {
  const saved = localStorage.getItem("brt_theme");
  if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");

  document.getElementById("darkModeToggle").addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("brt_theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("brt_theme", "dark");
    }
  });
}

/* =========================================================
   16. EVENT WIRING
   ========================================================= */
function initNav() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  document.querySelectorAll("[data-view-link]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.viewLink));
  });
  document.getElementById("navToggle").addEventListener("click", () => {
    document.querySelector(".nav-links").classList.toggle("open");
  });
}

function initModalClosers() {
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".modal-overlay").classList.add("hidden"));
  });
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  });
}

function initLostForm() {
  const form = document.getElementById("lostForm");
  const msgEl = document.getElementById("lostFormMsg");
  const imageInput = document.getElementById("lostImage");
  const preview = document.getElementById("lostImagePreview");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const required = ["itemName", "category", "description", "color", "station", "date", "contactName", "contactNumber"];
    const { isValid, data } = validateForm(form, required);

    if (!isValid) {
      showFormMsg(msgEl, "Please fill all required fields with valid values.", "error");
      return;
    }

    readImageAsDataUrl(imageInput, preview, (imageData) => {
      const report = addLostItem(data, imageData);
      showFormMsg(msgEl, `Lost report submitted successfully! Your Report ID is ${report.id}.`, "success");
      form.reset();
      preview.classList.add("hidden");
      refreshAllViews();
    });
  });
}

function initFoundForm() {
  const form = document.getElementById("foundForm");
  const msgEl = document.getElementById("foundFormMsg");
  const imageInput = document.getElementById("foundImage");
  const preview = document.getElementById("foundImagePreview");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const required = ["itemName", "category", "description", "color", "station", "date", "contactName", "contactNumber"];
    const { isValid, data } = validateForm(form, required);

    if (!isValid) {
      showFormMsg(msgEl, "Please fill all required fields with valid values.", "error");
      return;
    }

    readImageAsDataUrl(imageInput, preview, (imageData) => {
      const report = addFoundItem(data, imageData);
      showFormMsg(msgEl, `Found report submitted successfully! Your Report ID is ${report.id}.`, "success");
      form.reset();
      preview.classList.add("hidden");
      refreshAllViews();
    });
  });
}

function initClaimForm() {
  const form = document.getElementById("claimForm");
  const msgEl = document.getElementById("claimFormMsg");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const required = ["ownerName", "contactNumber", "identifyingDetail"];
    const { isValid, data } = validateForm(form, required);

    if (!isValid) {
      showFormMsg(msgEl, "Please fill all required fields correctly.", "error");
      return;
    }

    const reportId = document.getElementById("claimReportId").value;
    submitClaim(reportId, data);
    showFormMsg(msgEl, "Claim Submitted. Our team will verify the details shortly.", "success");
    refreshAllViews();
    setTimeout(() => closeModal("claimModal"), 1200);
  });
}

function initEditForm() {
  const form = document.getElementById("editForm");
  const msgEl = document.getElementById("editFormMsg");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("editReportId").value;
    const required = ["itemName", "category", "description", "color", "station", "date", "contactName", "contactNumber"];
    const { isValid, data } = validateForm(form, required);

    if (!isValid) {
      showFormMsg(msgEl, "Please fill all required fields correctly.", "error");
      return;
    }

    editReport(id, data);
    showFormMsg(msgEl, "Report updated.", "success");
    refreshAllViews();
    setTimeout(() => closeModal("editModal"), 800);
  });
}

function initSearchControls() {
  ["searchInput", "filterType", "filterCategory", "filterStation", "sortOrder"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderSearchView);
    document.getElementById(id).addEventListener("change", renderSearchView);
  });
}

function initSampleDataButton() {
  document.getElementById("loadSampleBtn").addEventListener("click", loadSampleData);
}

/* =========================================================
   17. INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  initDarkMode();
  initNav();
  initModalClosers();
  initLostForm();
  initFoundForm();
  initClaimForm();
  initEditForm();
  initSearchControls();
  initSampleDataButton();
  refreshAllViews();
});
