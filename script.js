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

// --- WINDOW FUNCTIONS (ATTACH TO BUTTONS) ---
window.showSection = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    el.classList.add('active');
};

window.toggleMode = () => {
    document.getElementById('root-body').classList.toggle('dark-mode');
};

window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNumber;
    document.getElementById('v-title-up').innerText = c.lastUpdate || "Never";

    document.getElementById('v-info-grid').innerHTML = `
        <p><b>Location:</b> ${c.location}</p><p><b>Phone:</b> ${c.phone}</p>
        <p><b>Occupation:</b> ${c.occupation}</p><p><b>Referral:</b> ${c.referral}</p>
    `;

    document.getElementById('v-loan-grid').innerHTML = `
        <p><b>Principal:</b> KSH ${c.principal}</p><p><b>Balance:</b> KSH ${c.balance}</p>
        <p><b>Next Payment:</b> ${c.nextDue || 'Not Scheduled'}</p>
    `;

    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        return `<tr class="${isLate ? 'row-late' : ''} ${h.activity==='New Loan'?'row-new':''}">
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
        });
    }
});

function renderClients() {
    const body = document.getElementById('clientTableBody');
    body.innerHTML = allClients.map((c, i) => `
        <tr>
            <td><input type="checkbox" class="bulk-cb" value="${c.idNumber}" onchange="checkBulk()"></td>
            <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
            <td>${c.totalPaid || 0}</td><td>${c.balance || 0}</td>
            <td><button class="btn-main" onclick="openView('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

window.toggleSelectAll = (el) => {
    document.querySelectorAll('.bulk-cb').forEach(cb => cb.checked = el.checked);
    checkBulk();
};

window.checkBulk = () => {
    const count = document.querySelectorAll('.bulk-cb:checked').length;
    document.getElementById('bulkDeleteBtn').style.display = count > 0 ? 'inline-block' : 'none';
};

window.bulkDelete = async () => {
    if(!confirm("Are you sure you want to delete selected records?")) return;
    const ids = Array.from(document.querySelectorAll('.bulk-cb:checked')).map(cb => cb.value);
    for(let id of ids) await remove(ref(db, 'jml_data/' + id));
    alert("Records deleted.");
};

window.handleTx = async (type) => {
    if(!confirm(`Proceed with ${type}?`)) return;
    const client = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('a-amt').value) || 0;
    const time = document.getElementById('a-time').value;

    let updateData = { lastUpdate: new Date().toLocaleString() };

    if(type === 'Payment') {
        updateData.balance = client.balance - amt;
        updateData.totalPaid = (client.totalPaid || 0) + amt;
        updateData.history = [...(client.history || []), {
            date: new Date().toLocaleDateString(),
            activity: 'Payment', details: `KSH ${amt}`, time: time, by: auth.currentUser.email
        }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    }

    await update(ref(db, 'jml_data/' + activeID), updateData);
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
    alert("Client Enrolled.");
};

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
