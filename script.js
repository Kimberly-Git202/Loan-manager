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

// --- ATTACH TO WINDOW SO BUTTONS WORK ---
window.showSection = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    el.classList.add('active');
};

window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    // Set Header & Info
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNumber;
    document.getElementById('v-last-update').innerText = c.lastUpdate || "Never";
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-phone').innerText = c.phone;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;

    // Set Loan Data
    document.getElementById('v-princ').innerText = "KSH " + c.principal;
    document.getElementById('v-paid').innerText = "KSH " + (c.totalPaid || 0);
    document.getElementById('v-bal').innerText = "KSH " + (c.balance || 0);
    document.getElementById('v-next').innerText = c.nextDue || "No payment set";

    // History Table with 6PM logic
    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        return `<tr class="${isLate ? 'row-late' : ''} ${h.activity === 'New Loan' ? 'row-new' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- DATA LISTENER ---
onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        onValue(ref(db, 'jml_data'), snap => {
            allClients = snap.val() ? Object.values(snap.val()) : [];
            renderClients();
            calculateFinancials();
        });
    }
});

function renderClients() {
    const body = document.getElementById('clientTableBody');
    body.innerHTML = allClients.map((c, i) => `
        <tr>
            <td><input type="checkbox" class="c-check" value="${c.idNumber}" onchange="checkSelected()"></td>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td>
            <td>KSH ${c.balance || 0}</td>
            <td><button class="btn-main" onclick="openView('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

// --- BULK DELETE LOGIC ---
window.toggleSelectAll = () => {
    const master = document.getElementById('selectAll').checked;
    document.querySelectorAll('.c-check').forEach(c => c.checked = master);
    checkSelected();
};

window.checkSelected = () => {
    const any = document.querySelectorAll('.c-check:checked').length > 0;
    document.getElementById('bulkDeleteBtn').style.display = any ? 'block' : 'none';
};

window.bulkDelete = async () => {
    if(!confirm("Delete all selected clients? This cannot be undone.")) return;
    const selected = Array.from(document.querySelectorAll('.c-check:checked')).map(i => i.value);
    for(let id of selected) {
        await remove(ref(db, 'jml_data/' + id));
    }
    alert("Deleted successfully.");
};

// --- TRANSACTION PROCESSING ---
window.processTx = async (type) => {
    if(!confirm(`Confirm ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const next = document.getElementById('act-next').value;

    let up = { lastUpdate: new Date().toLocaleString() };

    if(type === 'Payment') {
        up.balance = (c.balance || 0) - amt;
        up.totalPaid = (c.totalPaid || 0) + amt;
        up.nextDue = next;
        up.history = [...(c.history || []), { 
            date: new Date().toLocaleDateString(), 
            activity: 'Payment', 
            details: `Paid KSH ${amt}`, 
            time: time, 
            by: auth.currentUser.email 
        }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    }

    await update(ref(db, 'jml_data/' + activeID), up);
    openView(activeID);
};

// --- HELPERS ---
window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const p = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: p,
        balance: p,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${p}`, time: '09:00', by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), data);
    showSection('list-sec', document.querySelector('.nav-item'));
};

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
