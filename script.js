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

// AUTH & BOOTSTRAP
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
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
    onValue(ref(db, 'jml_data'), (snap) => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderTable();
        calcFinance();
        renderSettled();
        renderLoans();
        renderReports();
    });
}

// 1. CLIENTS TABLE
function renderTable() {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = allClients
        .filter(c => c.name.toLowerCase().includes(q) || c.idNumber.includes(q))
        .map((c, i) => `
            <tr>
                <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
                <td>KSH ${c.totalPaid || 0}</td><td>KSH ${c.balance || 0}</td>
                <td><button class="btn-main" onclick="openView('${c.idNumber}')">VIEW</button></td>
            </tr>
        `).join('');
}

// 2. ENROLLMENT
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const p = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: p, balance: p, totalPaid: 0,
        startDate: document.getElementById('e-start').value, endDate: document.getElementById('e-end').value,
        status: 'Active', officer: auth.currentUser.email,
        history: [{
            date: new Date().toLocaleDateString(), activity: 'New Loan',
            details: `Issued KSH ${p}`, time: '09:00', by: auth.currentUser.email
        }]
    };
    set(ref(db, 'jml_data/' + id), data).then(() => alert("Saved!"));
};

// 3. VIEW LOGIC
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return alert("Error opening client. Data structure invalid.");
    activeID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-up').innerText = c.lastUpdated || 'Initial';
    document.getElementById('v-status').value = c.status;
    document.getElementById('v-officer').value = c.officer;
    
    document.getElementById('v-info-grid').innerHTML = `
        <p>Name: ${c.name}</p><p>ID: ${c.idNumber}</p><p>Phone: ${c.phone}</p>
        <p>Loc: ${c.location}</p><p>Occ: ${c.occupation}</p><p>Ref: ${c.referral}</p>
    `;
    
    document.getElementById('v-pri').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.balance;
    document.getElementById('v-next-txt').innerText = c.nextDue || 'None';

    // Highlight Red after 6pm (18:00)
    document.getElementById('v-history-body').innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        return `<tr class="${isLate ? 'late-payment' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// 4. TRANSACTION PROCESSING
window.processTx = (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('u-amt').value) || 0;
    const mTime = document.getElementById('u-time').value;
    
    let updates = { 
        lastUpdated: new Date().toLocaleString(),
        status: document.getElementById('v-status').value 
    };

    if(type === 'Payment') {
        updates.totalPaid = (c.totalPaid || 0) + amt;
        updates.balance = c.balance - amt;
        updates.nextDue = document.getElementById('u-next').value;
        updates.history = [...(c.history || []), {
            date: new Date().toLocaleDateString(), activity: 'Payment',
            details: `Paid KSH ${amt}`, time: mTime, by: auth.currentUser.email
        }];
    } else if(type === 'Settle') {
        updates.balance = 0;
        updates.status = 'Inactive';
        updates.archived = [...(c.archived || []), { amt: c.principal, date: new Date().toLocaleDateString() }];
    } else if(type === 'Delete') {
        remove(ref(db, 'jml_data/' + activeID)).then(closeModal);
        return;
    }

    update(ref(db, 'jml_data/' + activeID), updates).then(() => openView(activeID));
};

// 5. REPORTS (Admin View)
function renderReports() {
    if(auth.currentUser.email !== 'admin@jml.com') return;
    const officers = [...new Set(allClients.map(c => c.officer))];
    document.getElementById('report-list').innerHTML = officers.map(off => `
        <div class="stat-card">
            <h3>Officer: ${off}</h3>
            <p>Active Clients: ${allClients.filter(c => c.officer === off).length}</p>
        </div>
    `).join('');
}

// 6. LOANS (Saturdays)
window.renderLoans = () => {
    const month = document.getElementById('loan-month').value;
    const week = document.getElementById('loan-week').value;
    // Logic filters based on Saturday dates within that week/month
    document.getElementById('loanTableBody').innerHTML = allClients
        .filter(c => c.startDate && c.startDate.includes(month))
        .map(c => `<tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>`)
        .join('');
};

window.purgeDatabase = () => {
    if(confirm("THIS WILL WIPE EVERYTHING. Use only to fix dummy data issues. Proceed?")) {
        remove(ref(db, 'jml_data')).then(() => location.reload());
    }
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.getElementById('app-body').classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
window.closeModal = () => document.getElementById('view-modal').classList.add('hidden');
window.doSearch = () => renderTable();
