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

// --- AUTH & LOGIN ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Access Denied"));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-wrapper').classList.remove('hidden');
        document.getElementById('current-user-email').innerText = user.email;
        startRealtimeSync();
    }
});

function startRealtimeSync() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderTable();
        calcFinance();
    });
    onValue(ref(db, 'jml_debts'), snap => {
        const debts = snap.val() ? Object.values(snap.val()) : [];
        renderDebts(debts);
    });
}

// --- CLIENT ENROLLMENT (1.25x Logic) ---
window.enrollClient = () => {
    const p = parseFloat(document.getElementById('e-princ').value);
    const balance = p * 1.25; // 25% Interest logic
    const id = document.getElementById('e-id').value;

    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: p, balance: balance, totalPaid: 0,
        startDate: document.getElementById('e-start').value, 
        endDate: document.getElementById('e-end').value,
        status: 'Active', officer: auth.currentUser.email,
        history: [{ 
            date: new Date().toLocaleDateString(), 
            activity: 'New Loan', 
            details: `KSH ${p} issued (Bal: ${balance})`, 
            time: '09:00', by: auth.currentUser.email 
        }]
    };
    set(ref(db, 'jml_data/' + id), data).then(() => alert("Profile Saved!"));
};

// --- CLIENT VIEW & HISTORY (6 PM Logic) ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-up').innerText = c.lastUpdated || 'New';
    document.getElementById('v-status').value = c.status;
    document.getElementById('v-officer').value = c.officer;

    document.getElementById('v-info-list').innerHTML = `
        <p>Full Name: <b>${c.name}</b></p><p>ID: <b>${c.idNumber}</b></p>
        <p>Phone: <b>${c.phone}</b></p><p>Location: <b>${c.location}</b></p>
        <p>Occupation: <b>${c.occupation}</b></p><p>Referral: <b>${c.referral}</b></p>
        <p>Dates: <b>${c.startDate} to ${c.endDate}</b></p>
    `;

    document.getElementById('v-pri').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.balance;
    document.getElementById('v-next-txt').innerText = c.nextDue || '--';
    document.getElementById('v-notes').value = c.notes || '';

    // History highlighting (6 PM and New Loan Start)
    document.getElementById('v-history-body').innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00"; 
        const isNew = h.activity === 'New Loan';
        return `<tr class="${isLate ? 'late-row' : ''} ${isNew ? 'new-marker' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('v-archived-body').innerHTML = (c.archived || []).map(a => `
        <tr><td>KSH ${a.amt}</td><td>${a.date}</td></tr>
    `).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- PROCESS UPDATES ---
window.processTx = (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('u-amt').value) || 0;
    const t = document.getElementById('u-time').value;

    let up = { 
        lastUpdated: new Date().toLocaleString(),
        status: document.getElementById('v-status').value,
        notes: document.getElementById('v-notes').value
    };

    if(type === 'Payment') {
        up.totalPaid = (c.totalPaid || 0) + amt;
        up.balance = (c.balance || 0) - amt;
        up.nextDue = document.getElementById('u-next').value;
        up.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'Payment', details: `Paid ${amt}`, time: t, by: auth.currentUser.email }];
    } else if(type === 'Settle') {
        up.status = 'Inactive';
        up.balance = 0;
        up.settledDate = new Date().toLocaleDateString();
        up.archived = [...(c.archived || []), { amt: c.principal, date: up.settledDate }];
        up.history = [...(c.history || []), { date: up.settledDate, activity: 'Settle', details: 'Cleared', time: t, by: auth.currentUser.email }];
    } else if(type === 'Delete') {
        remove(ref(db, 'jml_data/' + activeID)).then(closeModal); return;
    }

    update(ref(db, 'jml_data/' + activeID), up).then(() => openView(activeID));
};

// --- NAVIGATION & UI ---
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.getElementById('app-body').classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
window.closeModal = () => document.getElementById('view-modal').classList.add('hidden');
