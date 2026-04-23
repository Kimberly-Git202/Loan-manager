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

// --- AUTHENTICATION ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(() => alert("Access Denied"));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-wrapper').classList.remove('hidden');
        document.getElementById('current-user-email').innerText = user.email;
        startSync();
    }
});

function startSync() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderTable();
    });
}

// --- CORE FUNCTIONS ---
window.enrollClient = () => {
    const p = parseFloat(document.getElementById('e-princ').value);
    const balance = p * 1.25; // Standard JML 25% Interest
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
            activity: 'New Loan Started', 
            details: `Principal: ${p}`, 
            time: '08:00', by: auth.currentUser.email 
        }]
    };
    set(ref(db, 'jml_data/' + id), data).then(() => {
        alert("Enrolled!");
        showSec('list-sec', document.querySelector('.nav-item'));
    });
};

window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-up').innerText = c.lastUpdated || 'Initial';
    document.getElementById('v-status').value = c.status;

    document.getElementById('v-info-list').innerHTML = `
        <div class="row"><span>Phone:</span> <b>${c.phone}</b></div>
        <div class="row"><span>Loc:</span> <b>${c.location}</b></div>
        <div class="row"><span>Occ:</span> <b>${c.occupation}</b></div>
        <div class="row"><span>Ref:</span> <b>${c.referral}</b></div>
        <div class="row"><span>Duration:</span> <b>${c.startDate} to ${c.endDate}</b></div>
    `;

    document.getElementById('v-pri').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.balance;
    document.getElementById('v-next-txt').innerText = c.nextDue || 'Not Set';
    document.getElementById('v-notes').value = c.notes || '';

    // History & 6PM Rule
    document.getElementById('v-history-body').innerHTML = (c.history || []).reverse().map(h => {
        const isLate = h.time && h.time > "18:00"; 
        const isNew = h.activity === 'New Loan Started';
        return `<tr class="${isLate ? 'late-row' : ''} ${isNew ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.add('modal-show');
    document.getElementById('view-modal').classList.remove('hidden');
};

window.processTx = (type) => {
    if(!confirm(`Confirm ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('u-amt').value) || 0;
    const time = document.getElementById('u-time').value;

    let up = { 
        lastUpdated: new Date().toLocaleString(),
        status: document.getElementById('v-status').value,
        notes: document.getElementById('v-notes').value
    };

    if(type === 'Payment') {
        up.totalPaid = (c.totalPaid || 0) + amt;
        up.balance = (c.balance || 0) - amt;
        up.nextDue = document.getElementById('u-next').value;
        up.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'Payment', details: `Paid ${amt}`, time, by: auth.currentUser.email }];
    } else if (type === 'Settle') {
        up.status = 'Inactive';
        up.balance = 0;
        up.archived = [...(c.archived || []), { amt: c.principal, date: new Date().toLocaleDateString() }];
    } else if (type === 'Delete') {
        remove(ref(db, 'jml_data/' + activeID)).then(closeModal); return;
    }

    update(ref(db, 'jml_data/' + activeID), up).then(() => openView(activeID));
};

// --- UI UTILS ---
window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('minimized');
};

window.showSec = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
};

window.closeModal = () => {
    document.getElementById('view-modal').classList.remove('modal-show');
    setTimeout(() => document.getElementById('view-modal').classList.add('hidden'), 300);
};

window.renderTable = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const body = document.getElementById('clientTableBody');
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(q) || c.idNumber.includes(q));
    
    document.getElementById('client-count').innerText = `${filtered.length} Total`;
    body.innerHTML = filtered.map((c, i) => `
        <tr onclick="openView('${c.idNumber}')" style="cursor:pointer">
            <td>${i+1}</td><td><b>${c.name}</b></td><td>${c.idNumber}</td><td>${c.phone}</td>
            <td>${c.totalPaid}</td><td class="red-text">${c.balance}</td>
            <td><button class="btn-view">VIEW</button></td>
        </tr>
    `).join('');
};
