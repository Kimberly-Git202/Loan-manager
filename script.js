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
let selectedIDs = new Set();
let pressTimer;

// --- AUTH ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        onValue(ref(db, 'jml_data'), snap => {
            allClients = snap.val() ? Object.values(snap.val()) : [];
            renderClients();
        });
    }
});

// --- RENDER & LONG PRESS ---
function renderClients() {
    const body = document.getElementById('clientTableBody');
    body.innerHTML = allClients.map((c, i) => `
        <tr id="row-${c.idNumber}" 
            onmousedown="startPress('${c.idNumber}')" 
            onmouseup="endPress()" 
            onmouseleave="endPress()"
            class="${selectedIDs.has(c.idNumber) ? 'selected-row' : ''}">
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td>
            <td>KSH ${c.balance || 0}</td>
            <td><button class="btn-main small" onclick="openView('${c.idNumber}')">VIEW</button></td>
        </tr>
    `).join('');
}

window.startPress = (id) => {
    pressTimer = window.setTimeout(() => toggleSelect(id), 800);
};
window.endPress = () => clearTimeout(pressTimer);

function toggleSelect(id) {
    if(selectedIDs.has(id)) selectedIDs.delete(id);
    else selectedIDs.add(id);
    
    const bar = document.getElementById('bulk-action-bar');
    bar.classList.toggle('hidden', selectedIDs.size === 0);
    document.getElementById('selected-count').innerText = `${selectedIDs.size} selected`;
    renderClients();
}

window.bulkDelete = async () => {
    if(!confirm(`Delete ${selectedIDs.size} profiles? Are you sure?`)) return;
    for(let id of selectedIDs) await remove(ref(db, 'jml_data/' + id));
    selectedIDs.clear();
    document.getElementById('bulk-action-bar').classList.add('hidden');
};

// --- VIEW ENGINE ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    // Header
    document.getElementById('v-name-top').innerText = c.name;
    document.getElementById('v-id-top').innerText = c.idNumber;
    document.getElementById('v-time-top').innerText = c.lastUpdate || "---";
    document.getElementById('v-status-select').value = c.status || 'Active';
    document.getElementById('v-officer-input').value = c.officer || '';

    // Info Box
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNumber;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-info-job').innerText = c.occupation;
    document.getElementById('v-info-ref').innerText = c.referral;

    // Loan Box
    document.getElementById('v-loan-princ').innerText = c.principal;
    document.getElementById('v-loan-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-loan-bal').innerText = c.balance || 0;
    document.getElementById('v-loan-next').innerText = c.nextDue || '---';

    // Dates
    document.getElementById('up-start').value = c.startDate || '';
    document.getElementById('up-end').value = c.endDate || '';

    // History (6PM Check)
    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00"; 
        return `<tr class="${isLate ? 'late-row' : ''} ${h.activity==='New Loan' ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

window.processUpdate = async (type) => {
    if(!confirm("Are you sure?")) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('up-amt').value) || 0;
    const time = document.getElementById('up-time').value;
    const next = document.getElementById('up-next').value;

    let up = { 
        lastUpdate: new Date().toLocaleString(),
        status: document.getElementById('v-status-select').value,
        officer: document.getElementById('v-officer-input').value,
        startDate: document.getElementById('up-start').value,
        endDate: document.getElementById('up-end').value
    };

    if(type === 'Payment') {
        up.balance = (c.balance || 0) - amt;
        up.totalPaid = (c.totalPaid || 0) + amt;
        up.nextDue = next;
        up.history = [...(c.history || []), { 
            date: new Date().toLocaleDateString(), activity: 'Payment', 
            details: `Paid KSH ${amt}`, time, by: auth.currentUser.email 
        }];
    } else if (type === 'Settle') {
        up.archives = [...(c.archives || []), { amt: c.principal, date: new Date().toLocaleDateString() }];
        up.balance = 0;
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    }

    await update(ref(db, 'jml_data/' + activeID), up);
    openView(activeID);
};

window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: princ, balance: princ, startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: princ, time: '09:00', by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), data);
    alert("Profile Created!");
};

// --- MISC ---
window.showSection = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    el.classList.add('active');
};
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.toggleMode = () => document.getElementById('app-body').classList.toggle('dark-mode');
window.handleLogout = () => signOut(auth).then(() => location.reload());
