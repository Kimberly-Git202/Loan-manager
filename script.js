import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

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
let activeID = null;

// --- UI HELPERS ---
window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    if (window.innerWidth <= 900) { sb.classList.toggle('active'); }
    else { sb.classList.toggle('minimized'); main.classList.toggle('expanded'); }
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('active');
};

// --- DATA LOAD ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        fetchData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function fetchData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderClients();
        calculateFinancials();
        renderSettled();
        renderDebts();
    });
}

// --- CLIENT LIST ---
function renderClients() {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = allClients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td>
            <td>KSH ${c.balance || 0}</td>
            <td><button class="btn-post" onclick="openView('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

// --- ENROLLMENT ---
window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if (!id || !princ) return alert("Missing ID or Principal!");

    const clientObj = {
        name: document.getElementById('e-name').value,
        phone: document.getElementById('e-phone').value,
        idNumber: id,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        totalPaid: 0,
        balance: princ,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: "Active",
        history: [{
            date: new Date().toLocaleDateString(),
            activity: "New Loan",
            details: `KSH ${princ} Issued`,
            time: "09:00",
            by: auth.currentUser.email
        }]
    };

    await set(ref(db, 'jml_data/' + id), clientObj);
    alert("Client Saved Successfully!");
    showSection('list-sec');
};

// --- VIEW CLIENT DASHBOARD ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if (!c) return;
    activeID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = c.balance || 0;
    document.getElementById('v-next').innerText = c.nextPayment || "---";
    document.getElementById('v-start').innerText = c.startDate || "---";
    document.getElementById('v-end').innerText = c.endDate || "---";
    document.getElementById('status-display').innerText = c.status || "Active";
    document.getElementById('v-officer').value = c.officer || "";

    // History Logic with RED highlights
    const historyBody = document.getElementById('v-history-body');
    historyBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        const isNewLoan = h.activity === "New Loan";
        return `<tr class="${isLate ? 'row-red' : ''} ${isNewLoan ? 'new-loan-mark' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    // Archived Loans
    const archBody = document.getElementById('v-archived-body');
    archBody.innerHTML = (c.archived || []).map(a => `<tr><td>KSH ${a.amount}</td><td>${a.clearedDate}</td></tr>`).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- ACTIONS (Payment, Settle, New) ---
window.processAction = async (type) => {
    const client = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const manualTime = document.getElementById('act-time').value;
    const dueInfo = document.getElementById('act-due').value;

    if (!confirm(`Are you sure you want to ${type}?`)) return;

    let updates = {};
    const timestamp = {
        date: new Date().toLocaleDateString(),
        time: manualTime || "---",
        by: auth.currentUser.email
    };

    if (type === 'Payment') {
        updates.balance = client.balance - amt;
        updates.totalPaid = (client.totalPaid || 0) + amt;
        updates.nextPayment = dueInfo;
        updates.history = [...(client.history || []), { ...timestamp, activity: "Payment", details: `KSH ${amt}` }];
    } else if (type === 'Settle') {
        const archived = [...(client.archived || []), { amount: client.principal, clearedDate: new Date().toLocaleDateString() }];
        updates.balance = 0;
        updates.status = "Settled";
        updates.archived = archived;
        updates.history = [...(client.history || []), { ...timestamp, activity: "Loan Settled", details: "Balance Cleared" }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    } else if (type === 'New') {
        updates.principal = amt;
        updates.balance = amt;
        updates.totalPaid = 0;
        updates.history = [...(client.history || []), { ...timestamp, activity: "New Loan", details: `KSH ${amt} Started` }];
    } else if (type === 'Save') {
        updates.status = document.getElementById('v-status-select').value;
        updates.officer = document.getElementById('v-officer').value;
    }

    await update(ref(db, 'jml_data/' + activeID), updates);
    openView(activeID);
};

// --- FINANCIALS ---
window.calculateFinancials = () => {
    const today = new Date().toLocaleDateString();
    const selMonth = document.getElementById('fin-month').value; // YYYY-MM
    
    let totalOut = 0, totalToday = 0, totalMonth = 0;

    allClients.forEach(c => {
        totalOut += (c.balance || 0);
        (c.history || []).forEach(h => {
            if (h.activity === "Payment") {
                const amt = parseFloat(h.details.replace('KSH ', ''));
                if (h.date === today) totalToday += amt;
                if (h.date.includes(selMonth)) totalMonth += amt;
            }
        });
    });

    document.getElementById('fin-out').innerText = "KSH " + totalOut;
    document.getElementById('fin-today').innerText = "KSH " + totalToday;
    document.getElementById('fin-month-val').innerText = "KSH " + totalMonth;
};

// --- SEARCH ---
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};

// --- LOANS GIVEN (SATURDAY LOGIC) ---
window.renderLoansGiven = () => {
    const m = document.getElementById('loan-m-filter').value;
    const w = parseInt(document.getElementById('loan-w-filter').value);
    const body = document.getElementById('loanGivenBody');
    
    const filtered = allClients.filter(c => {
        const d = new Date(c.startDate);
        const day = d.getDay(); // 6 is Saturday
        const weekNum = Math.ceil(d.getDate() / 7);
        return c.startDate.startsWith(m) && day === 6 && weekNum === w;
    });

    body.innerHTML = filtered.map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>
    `).join('');
};

window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.handleLogout = () => signOut(auth).then(() => location.reload());

