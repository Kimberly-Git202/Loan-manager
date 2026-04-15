import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let allClients = [];
let isAdmin = false;
let activeID = null;

// --- Authentication ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        const uData = snap.val() || { role: 'staff', status: 'active' };
        if(uData.status === 'denied') { alert("Access Denied"); signOut(auth); return; }
        
        isAdmin = uData.role === 'admin';
        document.getElementById('login-overlay').classList.add('hidden');
        if(isAdmin) document.getElementById('admin-panel').classList.remove('hidden');
        document.getElementById('user-display-role').innerText = isAdmin ? "Administrator" : "Staff Member";
        
        loadData();
        loadDebts();
        loadSettledMaster();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// --- Data Core ---
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = [];
        Object.keys(data).forEach(uid => {
            Object.values(data[uid]).forEach(c => {
                if(isAdmin || c.ownerId === auth.currentUser.uid) allClients.push(c);
            });
        });
        renderTable(allClients);
        renderAccordion();
    });
}

function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const today = new Date().toLocaleDateString('en-GB');
    let dailyTotal = 0;

    tbody.innerHTML = list.map((c, i) => {
        const history = c.history || [];
        const lastPay = history.length > 0 ? history[history.length-1].date : 'None';
        const isSkipped = lastPay !== today;
        
        history.forEach(h => { if(h.date === today) dailyTotal += h.amt; });

        return `
            <tr style="${isSkipped ? 'background: #fff0f0; border-left: 5px solid red;' : ''}">
                <td>${i + 1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.idNumber}</td>
                <td>${c.totalPaid || 0}</td>
                <td>${c.balance}</td>
                <td>${isSkipped ? '❌ Skipped' : '✅ Paid'}</td>
                <td><button class="view-btn" onclick="openDashboard('${c.idNumber}')">Open</button></td>
            </tr>
        `;
    }).join('');
    document.getElementById('top-today').innerText = `Today: KSh ${dailyTotal.toLocaleString()}`;
}

// --- Dashboard Logic ---
window.openDashboard = (id) => {
    activeID = id;
    const c = allClients.find(x => x.idNumber === id);
    if(!c) return;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id').innerText = `ID: ${c.idNumber}`;
    document.getElementById('d-phone').innerText = `Phone: ${c.phone}`;
    document.getElementById('d-occ').innerText = `Occ: ${c.occupation}`;
    document.getElementById('ed-start').value = c.startDate || "";
    document.getElementById('ed-end').value = c.endDate || "";
    document.getElementById('ed-princ').value = c.principal;
    document.getElementById('d-balance').innerText = `KSh ${c.balance}`;
    
    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr><td>${h.date}</td><td>${h.amt}</td><td>${h.by}</td></tr>
    `).join('');

    const pastCon = document.getElementById('pastLoansContainer');
    pastCon.innerHTML = (c.pastLoans || []).map(p => `
        <div class="info-card" style="margin-bottom:5px;">
            Cleared ${p.clearedDate}: KSh ${p.principal} (Paid ${p.totalPaid})
        </div>
    `).join('') || "No archived loans.";

    document.getElementById('detailWindow').classList.remove('hidden');
};

window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const c = allClients.find(x => x.idNumber === activeID);
    if(!amt || !c) return;
    c.balance -= amt;
    c.totalPaid = (c.totalPaid || 0) + amt;
    if(!c.history) c.history = [];
    c.history.push({ date: new Date().toLocaleDateString('en-GB'), amt: amt, by: auth.currentUser.email.split('@')[0] });
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

window.updateField = async (field, val) => {
    const c = allClients.find(x => x.idNumber === activeID);
    c[field] = val;
    if(field === 'principal') c.balance = (parseFloat(val) * 1.25) - (c.totalPaid || 0);
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
};

window.settleAndReset = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(!confirm("Settle this loan? Old data stays on profile.")) return;
    
    const archive = { principal: c.principal, totalPaid: c.totalPaid, clearedDate: new Date().toLocaleDateString('en-GB') };
    if(!c.pastLoans) c.pastLoans = [];
    c.pastLoans.push(archive);
    
    await set(ref(db, `jml_settled_master/${c.idNumber}_${Date.now()}`), { ...archive, name: c.name, idNumber: c.idNumber, ownerId: c.ownerId });

    c.principal = parseFloat(prompt("New Principal:", c.principal)) || c.principal;
    c.balance = c.principal * 1.25; c.totalPaid = 0; c.history = []; c.startDate = ""; c.endDate = "";
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

// --- Grouping (Accordion) ---
function renderAccordion() {
    const container = document.getElementById('givenAccordion');
    container.innerHTML = "";
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let groups = {};
    allClients.forEach(c => {
        if(!c.startDate) return;
        const d = new Date(c.startDate);
        const m = months[d.getMonth()], w = `Week ${Math.ceil(d.getDate()/7)}`;
        if(!groups[m]) groups[m] = {}; if(!groups[m][w]) groups[m][w] = [];
        groups[m][w].push(c);
    });
    for(let m in groups){
        let html = `<details><summary>${m}</summary>`;
        for(let w in groups[m]){
            html += `<details style="margin-left:20px;"><summary>${w}</summary><ul>`;
            groups[m][w].forEach(c => html += `<li>${c.name} - KSh ${c.principal}</li>`);
            html += `</ul></details>`;
        }
        container.innerHTML += html + `</details>`;
    }
}

// --- Debts & Search ---
window.addDebtRow = async () => {
    const n = prompt("Name:"), a = prompt("Amount:");
    if(n && a) await set(ref(db, `jml_debts/${Date.now()}`), {name: n, amt: a, reason: "Manual Entry"});
};
function loadDebts() {
    onValue(ref(db, 'jml_debts'), (snap) => {
        const d = snap.val() || {};
        document.getElementById('debtTableBody').innerHTML = Object.entries(d).map(([id, val]) => `
            <tr><td>${val.name}</td><td>${val.amt}</td><td>${val.reason}</td>
            <td><button onclick="removeDebt('${id}')">Clear</button></td></tr>`).join('');
    });
}
window.removeDebt = (id) => remove(ref(db, `jml_debts/${id}`));

document.getElementById('globalSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(term) || c.idNumber.includes(term));
    renderTable(filtered);
});

// --- UI Helpers ---
document.getElementById('loginBtn').onclick = () => {
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
};
document.getElementById('toggleLoginPass').onclick = function() {
    const p = document.getElementById('login-password');
    p.type = p.type === "password" ? "text" : "password";
    this.classList.toggle('fa-eye-slash');
};
window.handleLogout = () => signOut(auth);
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');




