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

// --- LOGIN LOGIC ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    const status = document.getElementById('login-status');
    status.innerText = "Checking credentials...";
    signInWithEmailAndPassword(auth, e, p).catch(err => status.innerText = "Error: " + err.message);
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        onValue(ref(db, 'jml_data'), snap => {
            allClients = snap.val() ? Object.values(snap.val()) : [];
            renderMainTable();
        });
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// --- RENDER TABLES ---
function renderMainTable() {
    const body = document.getElementById('clientTableBody');
    body.innerHTML = allClients.map((c, i) => `
        <tr>
            <td><input type="checkbox" class="bulk-cb" value="${c.idNumber}" onchange="checkBulk()"></td>
            <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td><td>KSH ${c.balance || 0}</td>
            <td><button class="btn-main" onclick="openView('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNumber;
    document.getElementById('v-last-update').innerText = c.lastUpdate || "Initial Setup";
    
    document.getElementById('v-info-content').innerHTML = `
        <p><b>Phone:</b> ${c.phone}</p><p><b>Location:</b> ${c.location}</p>
        <p><b>Occupation:</b> ${c.occupation}</p><p><b>Referral:</b> ${c.referral}</p>
    `;

    document.getElementById('v-loan-content').innerHTML = `
        <p><b>Principal:</b> KSH ${c.principal}</p>
        <p><b>Current Balance:</b> KSH ${c.balance}</p>
        <p><b>Next Payment:</b> ${c.nextDue || 'Not set'}</p>
    `;

    // History Logic (Late Payment past 6 PM)
    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        return `<tr class="${isLate ? 'late-payment' : ''} ${h.activity === 'New Loan' ? 'new-loan-marker' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    // Archive Logic
    const aBody = document.getElementById('v-archive-body');
    aBody.innerHTML = (c.archives || []).map(a => `<tr><td>KSH ${a.amt}</td><td>${a.date}</td></tr>`).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- TRANSACTION ENGINE ---
window.handleTx = async (type) => {
    if(!confirm(`Proceed with ${type}?`)) return;
    const client = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const next = document.getElementById('act-next').value;

    let up = { lastUpdate: new Date().toLocaleString() };

    if(type === 'Payment') {
        up.balance = client.balance - amt;
        up.totalPaid = (client.totalPaid || 0) + amt;
        up.nextDue = next;
        up.history = [...(client.history || []), { 
            date: new Date().toLocaleDateString(), activity: 'Payment', 
            details: `Paid KSH ${amt}`, time, by: auth.currentUser.email 
        }];
    } else if (type === 'Settle') {
        up.archives = [...(client.archives || []), { amt: client.principal, date: new Date().toLocaleDateString() }];
        up.balance = 0;
        up.history = [...(client.history || []), { date: new Date().toLocaleDateString(), activity: 'Loan Settled', details: 'Full Clearance', time, by: auth.currentUser.email }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    } else if (type === 'Save') {
        up.status = document.getElementById('v-status-pill').value;
    }

    await update(ref(db, 'jml_data/' + activeID), up);
    openView(activeID);
};

// --- SATURDAY LOAN LOGIC ---
window.renderSaturdayLoans = () => {
    const month = document.getElementById('loan-month-pick').value;
    const week = document.getElementById('loan-week-pick').value;
    const tbody = document.getElementById('loanTableBody');
    
    // Filters based on issuance date in the specific month
    const filtered = allClients.filter(c => c.startDate && c.startDate.includes(month));
    tbody.innerHTML = filtered.map(c => `<tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>`).join('');
};

window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: princ, balance: princ, startDate: document.getElementById('e-start').value,
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${princ}`, time: '09:00', by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), data);
    alert("Profile Created Successfully");
};

// --- UI HELPERS ---
window.showSection = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    el.classList.add('active');
};
window.toggleMode = () => document.getElementById('app-body').classList.toggle('dark-mode');
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.handleLogout = () => signOut(auth).then(() => location.reload());
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
window.checkBulk = () => {
    const count = document.querySelectorAll('.bulk-cb:checked').length;
    document.getElementById('bulkDeleteBtn').style.display = count > 0 ? 'inline-block' : 'none';
};
window.toggleSelectAll = (el) => {
    document.querySelectorAll('.bulk-cb').forEach(cb => cb.checked = el.checked);
    checkBulk();
};
