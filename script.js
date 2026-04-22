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

// --- ATTACH TO WINDOW FOR HTML ACCESS ---
window.showSection = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    el.classList.add('active');
};

window.toggleMode = () => document.getElementById('app-body').classList.toggle('dark-mode');

window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    // Set UI Fields
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNumber;
    document.getElementById('v-last-update').innerText = c.lastUpdate || "Initial";
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-phone').innerText = c.phone;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;
    document.getElementById('v-princ').innerText = "KSH " + c.principal;
    document.getElementById('v-paid').innerText = "KSH " + (c.totalPaid || 0);
    document.getElementById('v-bal').innerText = "KSH " + (c.balance || 0);
    document.getElementById('v-next').innerText = c.nextDue || "Not Specified";
    document.getElementById('v-officer').value = c.officer || "";
    document.getElementById('v-notes').value = c.notes || "";

    // History & 6PM Check
    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00"; // Late if past 6PM
        return `<tr class="${isLate ? 'late-row' : ''} ${h.activity === 'New Loan' ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    // Archive
    const aBody = document.getElementById('v-archive-body');
    aBody.innerHTML = (c.archives || []).map(a => `<tr><td>KSH ${a.amt}</td><td>${a.date}</td></tr>`).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- DATA LISTENER ---
onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        onValue(ref(db, 'jml_data'), snap => {
            allClients = snap.val() ? Object.values(snap.val()) : [];
            renderTable();
        });
    }
});

function renderTable() {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = allClients.map((c, i) => `
        <tr>
            <td><input type="checkbox" class="bulk-cb" value="${c.idNumber}" onchange="checkBulk()"></td>
            <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td><td>KSH ${c.balance || 0}</td>
            <td><button class="btn-main" onclick="openView('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

// --- BULK DELETE ---
window.toggleSelectAll = (el) => {
    document.querySelectorAll('.bulk-cb').forEach(cb => cb.checked = el.checked);
    checkBulk();
};
window.checkBulk = () => {
    const selected = document.querySelectorAll('.bulk-cb:checked').length;
    document.getElementById('bulkDeleteBtn').style.display = selected > 0 ? 'inline-block' : 'none';
};
window.bulkDelete = async () => {
    if(!confirm("Are you sure you want to delete these profiles?")) return;
    const ids = Array.from(document.querySelectorAll('.bulk-cb:checked')).map(cb => cb.value);
    for(let id of ids) await remove(ref(db, 'jml_data/' + id));
};

// --- TRANSACTION ENGINE ---
window.processTx = async (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const next = document.getElementById('act-next').value;

    let up = { lastUpdate: new Date().toLocaleString() };

    if(type === 'Payment') {
        up.balance = (c.balance || 0) - amt;
        up.totalPaid = (c.totalPaid || 0) + amt;
        up.nextDue = next;
        up.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'Payment', details: `Paid KSH ${amt}`, time: time, by: auth.currentUser.email }];
    } else if (type === 'Settle') {
        up.archives = [...(c.archives || []), { amt: c.principal, date: new Date().toLocaleDateString() }];
        up.balance = 0;
        up.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'Settled', details: 'Full Clearance', time: time, by: auth.currentUser.email }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    } else if (type === 'Save') {
        up.status = document.getElementById('v-status-dropdown').value;
        up.officer = document.getElementById('v-officer').value;
        up.notes = document.getElementById('v-notes').value;
    }

    await update(ref(db, 'jml_data/' + activeID), up);
    openView(activeID);
};

window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const p = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: p, balance: p, startDate: document.getElementById('e-start').value,
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${p}`, time: '09:00', by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), data);
    alert("Enrolled!");
};

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
