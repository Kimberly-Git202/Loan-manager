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

// CRITICAL: Force functions to window for HTML buttons to work
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('minimized');
    document.getElementById('main-content').classList.toggle('expanded');
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

// --- CLIENT VIEW & DATA ---
function loadData() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderTable();
    });
}

function renderTable() {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = allClients.map((c, i) => `
        <tr>
            <td><input type="checkbox" class="client-check" value="${c.idNumber}"></td>
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

window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if (!c) return alert("Client data not found");
    activeID = id;

    // Mapping fields to UI
    document.getElementById('v-header-name').innerText = c.name;
    document.getElementById('v-header-id').innerText = c.idNumber;
    document.getElementById('v-header-updated').innerText = c.lastUpdate || "Initial";
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-phone').innerText = c.phone;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;
    document.getElementById('v-princ').innerText = "KSH " + c.principal;
    document.getElementById('v-paid').innerText = "KSH " + (c.totalPaid || 0);
    document.getElementById('v-bal').innerText = "KSH " + (c.balance || 0);
    document.getElementById('v-next').innerText = c.nextDue || "---";

    // History logic with 6PM red-highlight
    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        const isNew = h.activity === "New Loan";
        return `<tr class="${isLate ? 'late-payment' : ''} ${isNew ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- BULK DELETE FEATURE ---
window.toggleSelectAll = () => {
    const master = document.getElementById('selectAll').checked;
    document.querySelectorAll('.client-check').forEach(c => c.checked = master);
};

window.bulkDelete = async () => {
    const selected = Array.from(document.querySelectorAll('.client-check:checked')).map(c => c.value);
    if (selected.length === 0) return alert("Select clients to delete first");
    if (!confirm(`Delete ${selected.length} client profiles permanently?`)) return;

    for (const id of selected) {
        await remove(ref(db, 'jml_data/' + id));
    }
    alert("Records cleared.");
};

// --- TRANSACTIONS ---
window.transaction = async (type) => {
    if(!confirm(`Proceed with ${type}?`)) return;
    const client = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const t = document.getElementById('act-time').value;
    const due = document.getElementById('act-due').value;

    let updateData = { lastUpdate: new Date().toLocaleString() };

    if(type === 'Payment') {
        updateData.balance = client.balance - amt;
        updateData.totalPaid = (client.totalPaid || 0) + amt;
        updateData.nextDue = due;
        updateData.history = [...(client.history || []), {
            date: new Date().toLocaleDateString(),
            activity: "Payment",
            details: `Paid KSH ${amt}`,
            time: t,
            by: auth.currentUser.email
        }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    }

    await update(ref(db, 'jml_data/' + activeID), updateData);
    openView(activeID);
};

// Enrollment
window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const obj = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        balance: princ,
        startDate: document.getElementById('e-start').value,
        history: [{ date: new Date().toLocaleDateString(), activity: "New Loan", details: `Principal KSH ${princ}`, time: "09:00", by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), obj);
    showSection('list-sec');
};

// Auth
onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData();
    }
});

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
