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

// AUTHENTICATION
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-wrapper').classList.remove('hidden');
        document.getElementById('current-user-email').innerText = user.email;
        loadSystem();
    }
});

function loadSystem() {
    onValue(ref(db, 'jml_data'), snap => {
        const val = snap.val();
        allClients = val ? Object.values(val) : [];
        renderClientTable();
        calcFinance();
        renderDebts();
    });
}

// 1. CLIENTS TABLE
function renderClientTable() {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = allClients.map((c, i) => `
        <tr>
            <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td><td>KSH ${c.balance || 0}</td>
            <td><button class="btn-main" onclick="openView('${c.idNumber}')">VIEW</button></td>
        </tr>
    `).join('');
}

// 2. ENROLLMENT
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const p = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: p, balance: p, totalPaid: 0,
        startDate: document.getElementById('e-start').value, endDate: document.getElementById('e-end').value,
        status: 'Active', officer: auth.currentUser.email,
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${p} issued`, time: '09:00 AM', by: auth.currentUser.email }]
    };
    set(ref(db, 'jml_data/' + id), data).then(() => alert("Profile Saved"));
};

// 3. VIEW CLIENT (THE BOXES)
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    activeID = id;
    
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-up').innerText = c.lastUpdated || 'Never';
    document.getElementById('v-officer').value = c.officer;
    document.getElementById('v-status').value = c.status || 'Active';
    
    document.getElementById('v-info-list').innerHTML = `
        <p>Full Name: <b>${c.name}</b></p><p>ID: <b>${c.idNumber}</b></p>
        <p>Phone: <b>${c.phone}</b></p><p>Location: <b>${c.location}</b></p>
        <p>Occupation: <b>${c.occupation}</b></p><p>Referral: <b>${c.referral}</b></p>
    `;

    document.getElementById('v-pri').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = c.balance || 0;
    document.getElementById('v-next-txt').innerText = c.nextDue || '--';
    document.getElementById('v-notes').value = c.notes || '';
    document.getElementById('v-start-edit').value = c.startDate || '';
    document.getElementById('v-end-edit').value = c.endDate || '';

    // History + Red Highlighting Logic
    document.getElementById('v-history-body').innerHTML = (c.history || []).map(h => {
        // Red if Time >= 18:00 (6pm)
        const isLate = h.time && (h.time >= "18:00" || h.time.includes("PM") && parseInt(h.time) >= 6);
        return `<tr class="${isLate ? 'red-row' : ''} ${h.activity === 'New Loan' ? 'new-loan-marker' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// 4. PROCESS TRANSACTIONS
window.processTx = (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('u-amt').value) || 0;
    const manualTime = document.getElementById('u-time').value;

    let up = {
        lastUpdated: new Date().toLocaleString(),
        status: document.getElementById('v-status').value,
        notes: document.getElementById('v-notes').value,
        startDate: document.getElementById('v-start-edit').value,
        endDate: document.getElementById('v-end-edit').value
    };

    if(type === 'Payment') {
        up.totalPaid = (c.totalPaid || 0) + amt;
        up.balance = c.balance - amt;
        up.nextDue = document.getElementById('u-next').value;
        up.history = [...(c.history || []), {
            date: new Date().toLocaleDateString(), activity: 'Payment',
            details: `Paid KSH ${amt}`, time: manualTime, by: auth.currentUser.email
        }];
    } else if(type === 'Delete') {
        remove(ref(db, 'jml_data/' + activeID)).then(closeModal);
        return;
    }

    update(ref(db, 'jml_data/' + activeID), up).then(() => openView(activeID));
};

// 5. DEBTS
window.addDebt = () => {
    const id = document.getElementById('d-id').value;
    const data = {
        name: document.getElementById('d-name').value, id: id,
        principal: document.getElementById('d-princ').value,
        balance: document.getElementById('d-bal').value
    };
    set(ref(db, 'jml_debts/' + id), data);
};

function renderDebts() {
    onValue(ref(db, 'jml_debts'), snap => {
        const d = snap.val() ? Object.values(snap.val()) : [];
        document.getElementById('debtTableBody').innerHTML = d.map(x => `
            <tr><td>${x.name}</td><td>${x.id}</td><td>${x.principal}</td><td>${x.balance}</td>
            <td><button onclick="clearDebt('${x.id}')">CLEAR</button></td></tr>
        `).join('');
    });
}

window.clearDebt = (id) => { if(confirm("Clear this debt?")) remove(ref(db, 'jml_debts/' + id)); };

// UTILITIES
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.getElementById('app-body').classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
window.closeModal = () => document.getElementById('view-modal').classList.add('hidden');
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};
