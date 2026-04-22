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

// --- EXPOSE TO HTML ---
window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    if (window.innerWidth <= 900) sb.classList.toggle('active');
    else { sb.classList.toggle('minimized'); main.classList.toggle('expanded'); }
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('active');
};

// --- DATA LISTENER ---
onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData();
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderClients();
        calculateFinancials();
    });
}

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

// --- OPEN VIEW MODAL ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    // Header
    document.getElementById('v-name-header').innerText = c.name;
    document.getElementById('v-id-header').innerText = c.idNumber;
    document.getElementById('v-updated-header').innerText = c.lastUpdated || "Never";
    document.getElementById('v-status-badge').innerText = c.status || "Active";

    // Client Info Box
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-phone').innerText = c.phone;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;

    // Loan Box
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = c.balance || 0;
    document.getElementById('v-next').innerText = c.nextPay || "---";
    document.getElementById('v-start').innerText = c.startDate || "---";
    document.getElementById('v-end').innerText = c.endDate || "---";

    // Edit Fields
    document.getElementById('v-status-edit').value = c.status || "Active";
    document.getElementById('v-officer-edit').value = c.officer || "";
    document.getElementById('v-notes-display').innerText = c.notes || "No notes.";

    // Payment History
    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > '18:00';
        return `<tr class="${isLate ? 'row-late' : ''} ${h.activity === 'New Loan' ? 'row-new-loan' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    // Archived
    const aBody = document.getElementById('v-archived-body');
    aBody.innerHTML = (c.archived || []).map(a => `<tr><td>KSH ${a.amount}</td><td>${a.clearedDate}</td></tr>`).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- TRANSACTION ACTIONS ---
window.processAction = async (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const due = document.getElementById('act-due').value;

    let updates = { lastUpdated: new Date().toLocaleString() };

    if(type === 'Payment') {
        updates.balance = (c.balance || 0) - amt;
        updates.totalPaid = (c.totalPaid || 0) + amt;
        updates.nextPay = `sh ${amt} due on ${due}`;
        updates.history = [...(c.history || []), { 
            date: new Date().toLocaleDateString(), 
            activity: 'Payment', 
            details: `KSH ${amt}`, 
            time: time, 
            by: auth.currentUser.email 
        }];
    } else if (type === 'Settle') {
        updates.balance = 0;
        updates.status = 'Inactive';
        updates.archived = [...(c.archived || []), { amount: c.principal, clearedDate: new Date().toLocaleDateString() }];
        updates.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'Settled', details: 'Full Clearance', time: time, by: auth.currentUser.email }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        closeView(); return;
    } else if (type === 'Save') {
        updates.status = document.getElementById('v-status-edit').value;
        updates.officer = document.getElementById('v-officer-edit').value;
    } else if (type === 'New') {
        updates.principal = amt;
        updates.balance = amt;
        updates.totalPaid = 0;
        updates.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${amt}`, time: time, by: auth.currentUser.email }];
    }

    await update(ref(db, 'jml_data/' + activeID), updates);
    openView(activeID);
};

// --- FINANCIALS AUTOMATION ---
window.calculateFinancials = () => {
    let out = 0, today = 0, monthTotal = 0;
    const selMonth = document.getElementById('fin-month-pick').value; // YYYY-MM
    const todayStr = new Date().toLocaleDateString();

    allClients.forEach(c => {
        out += (c.balance || 0);
        (c.history || []).forEach(h => {
            if(h.activity === 'Payment') {
                const hAmt = parseFloat(h.details.replace('KSH ', '')) || 0;
                if(h.date === todayStr) today += hAmt;
                if(h.date.includes(selMonth)) monthTotal += hAmt;
            }
        });
    });

    document.getElementById('fin-out').innerText = `KSH ${out}`;
    document.getElementById('fin-today').innerText = `KSH ${today}`;
    document.getElementById('fin-month-val').innerText = `KSH ${monthTotal}`;
};

// --- SATURDAY LOAN SORTING ---
window.renderLoans = () => {
    const month = document.getElementById('loan-month').value;
    const week = parseInt(document.getElementById('loan-week').value);
    const body = document.getElementById('loanTableBody');

    const filtered = allClients.filter(c => {
        const d = new Date(c.startDate);
        const isSat = d.getDay() === 6;
        const wNum = Math.ceil(d.getDate() / 7);
        return c.startDate.startsWith(month) && isSat && wNum === week;
    });

    body.innerHTML = filtered.map(c => `<tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>`).join('');
};

window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        balance: princ,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: "Active",
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${princ}`, time: '09:00', by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), data);
    alert('Client Enrolled!'); showSection('list-sec');
};

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
