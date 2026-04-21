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

// --- ATTACH TO WINDOW TO FIX BUTTONS ---
window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    if(window.innerWidth <= 800) sb.classList.toggle('active');
    else { sb.classList.toggle('minimized'); main.classList.toggle('expanded'); }
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

// --- DATA LOGIC ---
onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData();
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderClientTable();
        calculateFinancials();
    });
}

function renderClientTable() {
    const body = document.getElementById('clientTableBody');
    body.innerHTML = allClients.map((c, i) => `
        <tr>
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

// --- VIEW DASHBOARD ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-name-title').innerText = c.name;
    document.getElementById('v-id-title').innerText = c.idNumber;
    document.getElementById('v-updated').innerText = c.lastUpdated || 'Never';

    const content = document.getElementById('v-content');
    content.innerHTML = `
        <div class="card">
            <h3>CLIENT INFORMATION</h3>
            <p>Full Name: ${c.name}</p><p>ID: ${c.idNumber}</p><p>Phone: ${c.phone}</p>
            <p>Location: ${c.location}</p><p>Occupation: ${c.occupation}</p><p>Referral: ${c.referral}</p>
        </div>
        <div class="card">
            <h3>CURRENT LOANS</h3>
            <div class="field-wrap"><label>Principal</label><div class="val-box">${c.principal}</div></div>
            <div class="field-wrap"><label>Total Paid</label><div class="val-box">${c.totalPaid || 0}</div></div>
            <div class="field-wrap"><label>Balance</label><div class="val-box">${c.balance}</div></div>
            <div class="field-wrap"><label>Next Payment</label><div class="val-box">${c.nextPay || '---'}</div></div>
        </div>
        <div class="card">
            <h3>EDIT STATUS</h3>
            <select id="v-status-sel"><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
            <input type="text" id="v-officer" placeholder="Loan Officer" value="${c.officer || ''}">
            <textarea id="v-note" placeholder="Add Notes...">${c.notes || ''}</textarea>
        </div>
        <div class="card" style="grid-column: span 2">
            <h3>PAYMENT HISTORY</h3>
            <table class="mini-table">
                <thead><tr><th>Date</th><th>Activity</th><th>Details</th><th>Time</th><th>Handled By</th></tr></thead>
                <tbody>${(c.history || []).map(h => {
                    const isLate = h.time && h.time > '18:00';
                    return `<tr class="${isLate ? 'row-late' : ''} ${h.activity === 'New Loan' ? 'row-new-loan' : ''}">
                        <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
        </div>
        <div class="card" style="grid-column: span 2">
            <h3>ACTIONS</h3>
            <div class="form-grid">
                <input type="number" id="act-amt" placeholder="Amount">
                <input type="time" id="act-time" placeholder="Time">
                <input type="text" id="act-next" placeholder="Next Payment Details">
                <button onclick="processAction('Payment')">Post Payment</button>
                <button onclick="processAction('Settle')">Settle Loan</button>
                <button onclick="processAction('New')">New Loan</button>
                <button onclick="processAction('Save')">Save Profile</button>
                <button onclick="processAction('Delete')" style="background:red">Delete Profile</button>
            </div>
        </div>
    `;
    document.getElementById('view-modal').classList.remove('hidden');
};

// --- CORE ACTIONS ---
window.processAction = async (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const next = document.getElementById('act-next').value;

    let updates = { lastUpdated: new Date().toLocaleString() };

    if(type === 'Payment') {
        updates.balance = (c.balance || 0) - amt;
        updates.totalPaid = (c.totalPaid || 0) + amt;
        updates.nextPay = next;
        updates.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'Payment', details: `KSH ${amt}`, time: time, by: auth.currentUser.email }];
    } else if (type === 'Settle') {
        updates.balance = 0;
        updates.status = 'Settled';
        updates.archived = [...(c.archived || []), { amount: c.principal, date: new Date().toLocaleDateString() }];
    } else if (type === 'Delete') {
        await remove(ref(db, 'jml_data/' + activeID));
        closeView(); return;
    }

    await update(ref(db, 'jml_data/' + activeID), updates);
    openView(activeID);
};

// --- FINANCIAL CALCULATIONS ---
window.calculateFinancials = () => {
    let out = 0, today = 0, monthTotal = 0;
    const selMonth = document.getElementById('fin-month-select').value;
    const now = new Date().toLocaleDateString();

    allClients.forEach(c => {
        out += (c.balance || 0);
        (c.history || []).forEach(h => {
            if(h.activity === 'Payment') {
                const amt = parseFloat(h.details.replace('KSH ', '')) || 0;
                if(h.date === now) today += amt;
                if(h.date.includes(selMonth)) monthTotal += amt;
            }
        });
    });
    document.getElementById('fin-out').innerText = `KSH ${out}`;
    document.getElementById('fin-today').innerText = `KSH ${today}`;
    document.getElementById('fin-month-val').innerText = `KSH ${monthTotal}`;
};

// --- SATURDAY LOANS FILTER ---
window.renderLoans = () => {
    const month = document.getElementById('loan-month-filter').value;
    const week = parseInt(document.getElementById('loan-week-filter').value);
    const body = document.getElementById('loanTableBody');
    
    const filtered = allClients.filter(c => {
        const d = new Date(c.startDate);
        const isSat = d.getDay() === 6;
        const weekNum = Math.ceil(d.getDate() / 7);
        return c.startDate.includes(month) && isSat && weekNum === week;
    });

    body.innerHTML = filtered.map(c => `<tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>`).join('');
};

window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const data = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: parseFloat(document.getElementById('e-princ').value),
        balance: parseFloat(document.getElementById('e-princ').value),
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        history: [{ date: new Date().toLocaleDateString(), activity: 'New Loan', details: 'Initial', time: '09:00', by: auth.currentUser.email }]
    };
    await set(ref(db, 'jml_data/' + id), data);
    alert('Enrolled!'); showSection('list-sec');
};

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
