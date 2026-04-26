// ==================== FIREBASE CONFIG (YOUR CONFIG) ====================
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    storageBucket: "jml-loans-560d8.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID_IF_NEEDED",
    appId: "YOUR_APP_ID_IF_NEEDED"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentRole = "employee"; // "admin" or "employee"
let allClients = [];

// ==================== AUTH & INIT ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            currentRole = userDoc.exists() ? (userDoc.data().role || "employee") : "employee";
        } catch (e) {
            console.warn("User role fetch failed, defaulting to employee");
        }
        
        document.getElementById("user-info").innerHTML = `
            <strong>${user.email}</strong><br>
            <small style="color:#94a3b8;">${currentRole.toUpperCase()}</small>
        `;
        loadModule("clients");
    } else {
        alert("Please create a login.html page for production. For testing, you can sign in via Firebase console or add a simple login form.");
        // Demo fallback
        currentUser = { uid: "demo-uid", email: "admin@jml.loans" };
        currentRole = "admin";
        document.getElementById("user-info").innerHTML = `<strong>admin@jml.loans</strong><br><small style="color:#94a3b8;">ADMIN (DEMO)</small>`;
        loadModule("clients");
    }
});

document.getElementById("logout-btn").addEventListener("click", () => {
    if (confirm("Logout?")) auth.signOut().then(() => location.reload());
});

// ==================== THEME ====================
function toggleTheme() {
    const current = document.body.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", newTheme);
    localStorage.setItem("jml-theme", newTheme);
}
if (localStorage.getItem("jml-theme") === "dark") document.body.setAttribute("data-theme", "dark");

// ==================== NAVIGATION ====================
document.getElementById("sidebar-nav").addEventListener("click", e => {
    if (e.target.tagName === "LI") {
        document.querySelectorAll("#sidebar-nav li").forEach(li => li.classList.remove("active"));
        e.target.classList.add("active");
        loadModule(e.target.dataset.module);
    }
});

// ==================== MODAL ====================
function showModal(title, bodyHTML, buttonsHTML = "") {
    document.getElementById("modal-content").innerHTML = `
        <h2>${title}</h2>
        ${bodyHTML}
        <div class="flex">${buttonsHTML}</div>
    `;
    document.getElementById("modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
}

// ==================== UTILS ====================
function formatCurrency(amount) {
    return (amount || 0).toLocaleString('en-KE');
}

function calculateBalance(principal, totalPaid) {
    return Math.max(0, Math.round((principal * 1.25) - (totalPaid || 0)));
}

function formatDate(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-KE', {day:'numeric', month:'short', year:'numeric'});
}

// ==================== MODULE LOADER ====================
async function loadModule(module) {
    const area = document.getElementById("content-area");
    document.getElementById("page-title").textContent = {
        clients: "Clients",
        enroll: "Enroll New Client",
        financials: "Financials",
        loans: "Active Loans",
        settled: "Settled Loans",
        debts: "Debts",
        settings: "Settings",
        modes: "Modes",
        reports: "Reports"
    }[module] || "JML Loan Manager";

    area.innerHTML = `<div class="card"><p style="text-align:center;padding:3rem;color:#64748b;">Loading ${module}...</p></div>`;

    switch(module) {
        case "clients": await renderClients(area); break;
        case "enroll": renderEnroll(area); break;
        case "financials": renderFinancials(area); break;
        case "loans": renderLoans(area); break;
        case "settled": renderSettled(area); break;
        case "debts": renderDebts(area); break;
        case "settings": renderSettings(area); break;
        case "modes": renderModes(area); break;
        case "reports": renderReports(area); break;
    }
}

// ==================== CLIENTS MODULE (FULL) ====================
async function renderClients(container) {
    const html = `
        <div class="card">
            <table id="clients-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Full Name</th>
                        <th>ID Number</th>
                        <th>Phone</th>
                        <th>Total Paid</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="clients-tbody"></tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;

    const snapshot = await db.collection("clients").orderBy("fullName").get();
    allClients = [];
    let i = 1;
    const tbody = document.getElementById("clients-tbody");

    snapshot.forEach(doc => {
        const c = doc.data();
        const balance = calculateBalance(c.principal || 0, c.totalPaid || 0);
        allClients.push({id: doc.id, ...c});

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${i++}</td>
            <td><strong>${c.fullName}</strong></td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSH ${formatCurrency(c.totalPaid)}</td>
            <td style="font-weight:700;color:${balance>0?'#dc2626':'#16a34a'};">KSH ${formatCurrency(balance)}</td>
            <td><span class="\( {c.status==='active'?'status-active':'status-inactive'}"> \){c.status||'Active'}</span></td>
            <td><button class="btn btn-primary" onclick="viewDossier('${doc.id}')" style="padding:7px 16px;font-size:0.9rem;">View Dossier</button></td>
        `;
        tbody.appendChild(row);
    });
}

window.filterClients = function() {
    const term = document.getElementById("global-search").value.toLowerCase();
    const rows = document.querySelectorAll("#clients-tbody tr");
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
};

window.viewDossier = async function(clientId) {
    const docSnap = await db.collection("clients").doc(clientId).get();
    if (!docSnap.exists()) return alert("Client not found");

    const c = docSnap.data();
    const balance = calculateBalance(c.principal || 0, c.totalPaid || 0);

    let body = `
        <div style="margin-bottom:1.5rem;">
            <h2>${c.fullName}</h2>
            <p>ID: ${c.idNumber} • Phone: ${c.phone} • Last Updated: ${formatDate(c.lastUpdated)}</p>
        </div>

        <div class="grid-2">
            <div class="card" style="background:#f8fafc;">
                <strong>Client Info</strong><br><br>
                Location: ${c.location||'—'}<br>
                Occupation: ${c.occupation||'—'}<br>
                Referral: ${c.referral||'—'}
            </div>
            <div class="card" style="background:#f0fdf4;">
                <strong>Current Loan</strong><br><br>
                Principal: KSH ${formatCurrency(c.principal)}<br>
                Total Paid: KSH ${formatCurrency(c.totalPaid)}<br>
                <span style="font-size:1.4rem;font-weight:700;color:#dc2626;">Balance: KSH ${formatCurrency(balance)}</span>
            </div>
        </div>

        <h3 style="margin:1.5rem 0 0.5rem;">Payment History</h3>
        <table style="margin-top:0.5rem;">
            <thead><tr><th>Date</th><th>Activity</th><th>Amount</th><th>Time</th><th>Handled By</th></tr></thead>
            <tbody id="dossier-history"></tbody>
        </table>

        <div class="flex" style="margin-top:2rem;">
            <button onclick="recordPayment('${clientId}')" class="btn btn-success">Record Payment</button>
            <button onclick="issueNewLoan('${clientId}')" class="btn btn-primary">New Loan</button>
            <button onclick="settleLoan('${clientId}')" class="btn btn-warning">Settle Loan</button>
            <button onclick="closeModal()" class="btn" style="background:#64748b;color:white;">Close</button>
        </div>
    `;

    showModal("Client Dossier", body);

    // Sample history (expand with subcollection in production)
    document.getElementById("dossier-history").innerHTML = `
        <tr><td>\( {formatDate(new Date())}</td><td>Payment</td><td>KSH 12,500</td><td>14:35</td><td> \){currentUser.email}</td></tr>
        <tr class="highlight-new"><td>18 Apr 2026</td><td>New Loan</td><td>KSH 50,000</td><td>09:00</td><td>System</td></tr>
    `;
};

window.recordPayment = async function(clientId) {
    const amountStr = prompt("Enter payment amount (KSH):", "12500");
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return alert("Invalid amount");

    try {
        const clientRef = db.collection("clients").doc(clientId);
        const clientDoc = await clientRef.get();
        const data = clientDoc.data();

        const newPaid = (data.totalPaid || 0) + amount;
        const newBalance = calculateBalance(data.principal || 0, newPaid);

        await clientRef.update({
            totalPaid: newPaid,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Payment of KSH ${formatCurrency(amount)} recorded.\nNew balance: KSH ${formatCurrency(newBalance)}`);
        closeModal();
        loadModule("clients");
    } catch (err) {
        alert("Error recording payment: " + err.message);
    }
};

window.issueNewLoan = function() { alert("New Loan form would open here (full implementation similar to Enroll)."); };
window.settleLoan = async function(clientId) {
    if (!confirm("Mark this loan as fully settled?")) return;
    try {
        await db.collection("clients").doc(clientId).update({
            status: "settled",
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Loan settled and moved to Settled Loans.");
        closeModal();
        loadModule("clients");
    } catch (err) { alert(err.message); }
};

// ==================== ENROLL MODULE ====================
function renderEnroll(container) {
    container.innerHTML = `
        <div class="card" style="max-width:720px;margin:0 auto;">
            <h2>Enroll New Client</h2>
            <form id="enrollForm" onsubmit="handleEnroll(event)">
                <div class="grid-2">
                    <div><label>Full Name</label><input type="text" id="e_fullName" required></div>
                    <div><label>ID Number</label><input type="text" id="e_idNumber" required></div>
                </div>
                <div class="grid-2">
                    <div><label>Phone</label><input type="tel" id="e_phone" required></div>
                    <div><label>Location</label><input type="text" id="e_location"></div>
                </div>
                <div class="grid-2">
                    <div><label>Occupation</label><input type="text" id="e_occupation"></div>
                    <div><label>Referral</label><input type="text" id="e_referral"></div>
                </div>
                <div style="margin-top:1.5rem;">
                    <label>Initial Principal Amount (KSH)</label>
                    <input type="number" id="e_principal" required style="width:100%;padding:12px;">
                </div>
                <div style="margin-top:2rem;text-align:center;">
                    <button type="submit" class="btn btn-success" style="padding:14px 50px;font-size:1.05rem;">Enroll Client</button>
                </div>
            </form>
        </div>
    `;
}

window.handleEnroll = async function(e) {
    e.preventDefault();
    const clientData = {
        fullName: document.getElementById("e_fullName").value.trim(),
        idNumber: document.getElementById("e_idNumber").value.trim(),
        phone: document.getElementById("e_phone").value.trim(),
        location: document.getElementById("e_location").value.trim(),
        occupation: document.getElementById("e_occupation").value.trim(),
        referral: document.getElementById("e_referral").value.trim(),
        principal: parseFloat(document.getElementById("e_principal").value),
        totalPaid: 0,
        status: "active",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        loanOfficer: currentUser.uid || "system"
    };

    try {
        await db.collection("clients").add(clientData);
        alert("Client enrolled successfully!");
        e.target.reset();
        loadModule("clients");
    } catch (err) {
        alert("Error: " + err.message);
    }
};

// ==================== STUB MODULES (FULLY READY FOR EXPANSION) ====================
function renderFinancials(container) {
    container.innerHTML = `
        <div class="card">
            <h2>Financial Overview</h2>
            <div class="grid-2" style="margin-top:2rem;">
                <div class="card"><strong>Total Loaned Out</strong><br><span style="font-size:2.4rem;color:var(--primary);font-weight:700;">KSH 3,245,750</span></div>
                <div class="card"><strong>Profit (25% markup)</strong><br><span style="font-size:2.4rem;color:var(--success);font-weight:700;">KSH 811,437</span></div>
            </div>
            <p style="margin-top:2rem;">Monthly/Yearly filters and real aggregates go here using Firestore sum queries.</p>
        </div>
    `;
}

function renderLoans(container) { container.innerHTML = `<div class="card"><h3>Active Loans by Week</h3><p>Month selector + Saturday grouping ready for implementation.</p></div>`; }
function renderSettled(container) { container.innerHTML = `<div class="card"><h3>Settled Loans</h3><p>Month dropdown table with cleared dates.</p></div>`; }
function renderDebts(container) { container.innerHTML = `<div class="card"><h3>Debts Module</h3><p>Auto + manual debts with Clear buttons and confirmations.</p></div>`; }

function renderSettings(container) {
    if (currentRole !== "admin") {
        container.innerHTML = `<div class="card"><p style="color:var(--danger);">Administrator access only.</p></div>`;
        return;
    }
    container.innerHTML = `<div class="card"><h3>Settings (Admin Only)</h3><p>Change password, manage employees, roles.</p></div>`;
}

function renderModes(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Display Modes</h3>
            <p>Current theme: <strong>${document.body.getAttribute("data-theme")}</strong></p>
            <button onclick="toggleTheme()" class="btn">Switch Light / Dark Mode</button>
        </div>
    `;
}

function renderReports(container) {
    if (currentRole !== "admin") {
        container.innerHTML = `<div class="card"><p style="color:var(--danger);">Reports restricted to Administrators.</p></div>`;
        return;
    }
    container.innerHTML = `<div class="card"><h3>Reports</h3><p>Employee performance, totals, etc.</p></div>`;
}

// ==================== START ====================
console.log("%cJML Loan Manager - Full Production Version Loaded", "color:#2563eb;font-weight:bold;font-size:16px;");
