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

// --- EXPOSE FUNCTIONS TO GLOBAL WINDOW ---
window.showSection = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    el.classList.add('active');
};

window.toggleMode = () => {
    document.getElementById('body-root').classList.toggle('dark-mode');
};

window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-h-name').innerText = c.name;
    document.getElementById('v-h-id').innerText = c.idNumber;
    document.getElementById('v-h-up').innerText = c.lastUpdate || "Initial";
    
    document.getElementById('v-info-block').innerHTML = `
        <b>Phone:</b> ${c.phone}<br><b>Location:</b> ${c.location}<br>
        <b>Occupation:</b> ${c.occupation}<br><b>Referral:</b> ${c.referral}
    `;

    document.getElementById('v-loan-block').innerHTML = `
        <div class="f-group"><label>Principal</label><div class="f-group">${c.principal}</div></div>
        <div class="f-group"><label>Balance</label><div class="f-group">${c.balance}</div></div>
        <div class="f-group"><label>Next</label><div class="f-group">${c.nextDue || '---'}</div></div>
    `;

    const hBody = document.getElementById('v-history-body');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        return `<tr class="${isLate ? 'late-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- DATA LOGIC ---
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
    const selected = document.querySelectorAll('.bulk-cb:checked').length;
    document.getElementById('bulkDeleteBtn').style.display = selected > 0 ? 'inline-block' : 'none';
};

window.bulkDelete = async () => {
    if(!confirm("Delete selected clients permanently?")) return;
    const ids = Array.from(document.querySelectorAll('.bulk-cb:checked')).map(cb => cb.value);
    for(let id of ids) {
        await remove(ref(db, 'jml_data/' + id));
    }
    alert("Deleted.");
};

window.handleTx = async (type) => {
    if(!confirm(`Proceed with ${type}?`)) return;
    const client = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('a-amt').value) || 0;
    const time = document.getElementById('a-time').value;
    const next = document.getElementById('a-next').value;

    let upData = { lastUpdate: new Date().toLocaleString() };

    if(type === 'Payment') {
        upData.balance = client.balance - amt;
        upData.totalPaid = (client.totalPaid || 0) + amt;
        upData.nextDue = next;
        upData.history = [...(client.history || []), {
            date: new Date().toLocaleDateString(),
            activity: 'Payment', details: `KSH ${amt}`,
            time: time, by: auth.currentUser.email
        }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        return closeView();
    }

    await update(ref(db, 'jml_data/' + activeID), upData);
    openView(activeID);
};

window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        balance: princ,
        startDate: document.getElementById('e-start').value,
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${princ}`, time: '09:00', by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), data);
    alert('Enrolled!');
};

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
