import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentUser = null;
let currentIndex = null;
let isAdmin = false;

// --- Theme Management ---
window.toggleTheme = () => {
    const body = document.body;
    if (body.classList.contains('light-mode')) {
        body.classList.replace('light-mode', 'dark-mode');
        localStorage.setItem('theme', 'dark-mode');
    } else {
        body.classList.replace('dark-mode', 'light-mode');
        localStorage.setItem('theme', 'light-mode');
    }
};

// Apply saved theme on load
const savedTheme = localStorage.getItem('theme') || 'light-mode';
document.body.classList.add(savedTheme);

// --- Auth ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        const userData = snap.val() || { role: 'staff' };
        isAdmin = userData.role === 'admin';
        
        document.getElementById('login-overlay').classList.add('hidden');
        if(isAdmin) document.getElementById('admin-nav').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// --- Data Management ---
function loadData() {
    // If admin, listen to root jml_data. If staff, listen only to their UID.
    const path = isAdmin ? 'jml_data' : `jml_data/${currentUser.uid}`;
    onValue(ref(db, path), (snap) => {
        const data = snap.val() || {};
        clients = [];
        
        if (isAdmin) {
            // Flatten nested user data for Admin
            Object.keys(data).forEach(uId => {
                Object.values(data[uId]).forEach(c => clients.push(c));
            });
        } else {
            clients = Object.values(data);
        }
        renderTable();
        renderSidebar();
    });
}

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.filter(c => !c.settled).map((c, i) => `
        <tr>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.totalPaid || 0}</td>
            <td style="color:var(--accent)">${c.balance}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">Open</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id').innerText = c.idNumber;
    document.getElementById('d-phone').innerText = c.phone || "N/A";
    document.getElementById('d-loc').innerText = c.location || "N/A";
    document.getElementById('d-occ').innerText = c.occupation || "N/A";
    document.getElementById('d-ref').innerText = c.referral || "N/A";
    document.getElementById('d-principal').innerText = c.principal;
    document.getElementById('d-balance').innerText = c.balance;
    document.getElementById('ed-start').value = c.startDate || "";
    document.getElementById('ed-end').value = c.endDate || "";

    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr><td>${h.date}</td><td>KSh ${h.amt}</td><td>${h.by}</td></tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
};

window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    if (!amt || currentIndex === null) return;

    const c = clients[currentIndex];
    c.balance -= amt;
    c.totalPaid = (c.totalPaid || 0) + amt;
    if(!c.history) c.history = [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        amt: amt,
        by: currentUser.email.split('@')[0]
    });

    await update(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(currentIndex);
};

window.settleAndReset = async () => {
    const c = clients[currentIndex];
    if(!confirm("Settle this loan and start a new one?")) return;

    // 1. Mark current loan as settled
    const settledLoan = {...c, settled: true, settledDate: new Date().toISOString()};
    await set(ref(db, `jml_settled/${c.ownerId}/${c.idNumber}_${Date.now()}`), settledLoan);

    // 2. Reset the client for a new loan
    const newPrincipal = parseFloat(prompt("Enter New Principal:", c.principal)) || c.principal;
    c.principal = newPrincipal;
    c.balance = newPrincipal * 1.25;
    c.totalPaid = 0;
    c.history = [];
    c.startDate = ""; 
    c.endDate = "";

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

// Sidebar Grouping
function renderSidebar() {
    const container = document.getElementById('givenAccordion');
    container.innerHTML = "";
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    let groups = {};
    clients.forEach(c => {
        if (!c.startDate) return;
        const d = new Date(c.startDate);
        const m = months[d.getMonth()];
        const w = `Week ${Math.ceil(d.getDate() / 7)}`;
        if(!groups[m]) groups[m] = {};
        if(!groups[m][w]) groups[m][w] = [];
        groups[m][w].push(c);
    });

    for (let m in groups) {
        let mHtml = `<details><summary>${m}</summary>`;
        for (let w in groups[m]) {
            mHtml += `<details style="margin-left:15px;"><summary>${w}</summary><ul>`;
            groups[m][w].forEach(c => mHtml += `<li>${c.name}</li>`);
            mHtml += `</ul></details>`;
        }
        container.innerHTML += mHtml + `</details>`;
    }
}

// Enrollment
document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const princ = parseFloat(document.getElementById('f-loan').value);
    const client = {
        name: document.getElementById('f-name').value,
        idNumber: id,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        occupation: document.getElementById('f-occ').value,
        referral: document.getElementById('f-ref').value,
        principal: princ,
        balance: princ * 1.25,
        startDate: document.getElementById('f-start').value || null,
        endDate: document.getElementById('f-end').value || null,
        ownerId: currentUser.uid,
        settled: false
    };
    await set(ref(db, `jml_data/${currentUser.uid}/${id}`), client);
    e.target.reset();
    showSection('list-sec');
});

// Boilerplate
window.handleLogin = () => {
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.togglePass = (id, icon) => {
    const el = document.getElementById(id);
    el.type = el.type === "password" ? "text" : "password";
    icon.classList.toggle('fa-eye-slash');
};


