import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, push } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

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

// --- AUTH ---
window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert("Login Failed"));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-wrapper').classList.remove('hidden');
        document.getElementById('current-user-email').innerText = user.email;
        syncData();
    }
});

function syncData() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderTable();
        calcFinance();
    });
}

// --- ENROLLMENT ---
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    if(!id) return alert("ID Required");
    
    const clientData = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: parseFloat(document.getElementById('e-princ').value) || 0,
        balance: parseFloat(document.getElementById('e-princ').value) || 0,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active',
        officer: auth.currentUser.email,
        history: [{
            date: new Date().toLocaleDateString(),
            activity: 'Enrollment',
            details: 'Initial Profile Created',
            time: 'N/A',
            by: auth.currentUser.email
        }]
    };
    
    set(ref(db, 'jml_data/' + id), clientData).then(() => {
        alert("Enrolled Successfully");
        showSec('list-sec');
    });
};

// --- VIEW & TRANSACTIONS ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    activeID = id;
    
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-up').innerText = c.lastUpdated || 'New';
    
    document.getElementById('v-info-grid').innerHTML = `
        <p><b>Phone:</b> ${c.phone}</p><p><b>Loc:</b> ${c.location}</p>
        <p><b>Occ:</b> ${c.occupation}</p><p><b>Ref:</b> ${c.referral}</p>
    `;

    document.getElementById('v-pri').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.balance;
    
    // Payment History with 6PM Rule
    document.getElementById('v-history-body').innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00"; 
        return `<tr class="${isLate ? 'late-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

window.processTx = (type) => {
    if(!confirm(`Confirm ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('u-amt').value) || 0;
    const time = document.getElementById('u-time').value;

    let updates = { lastUpdated: new Date().toLocaleString() };

    if(type === 'Payment') {
        updates.totalPaid = (c.totalPaid || 0) + amt;
        updates.balance = (c.balance || 0) - amt;
        const entry = { date: new Date().toLocaleDateString(), activity: 'Payment', details: `KSH ${amt}`, time, by: auth.currentUser.email };
        updates.history = [...(c.history || []), entry];
    } else if(type === 'Settle') {
        updates.status = 'Inactive';
        updates.balance = 0;
        updates.archivedDate = new Date().toLocaleDateString();
    }

    update(ref(db, 'jml_data/' + activeID), updates).then(() => closeModal());
};

// --- NAVIGATION & SEARCH ---
window.renderTable = () => {
    const query = document.getElementById('globalSearch').value.toLowerCase();
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = allClients
        .filter(c => c.name.toLowerCase().includes(query) || c.idNumber.includes(query))
        .map((c, i) => `
            <tr>
                <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
                <td>${c.totalPaid}</td><td>${c.balance}</td>
                <td><button onclick="openView('${c.idNumber}')">View</button></td>
            </tr>
        `).join('');
};

window.toggleTheme = () => {
    const b = document.getElementById('app-body');
    b.classList.toggle('light-mode');
    b.classList.toggle('dark-mode');
};

window.showSec = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
};

window.closeModal = () => document.getElementById('view-modal').classList.add('hidden');
