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

// --- 1. BOOTSTRAP & AUTH ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.email;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderMainTable();
        calculateFinancials();
        renderDebts();
    });
}

// --- 2. VIEW BUTTON (THE HEART OF THE SYSTEM) ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    activeID = id;
    
    const container = document.getElementById('modal-logic-gate');
    container.innerHTML = `
        <div class="dash-header">
            <div>
                <h1>${c.name}</h1>
                <p>ID: ${c.idNumber} | Last Updated: ${c.lastUpdated || 'Never'}</p>
            </div>
            <div class="dash-top-right">
                <div class="status-badge ${c.status}">${c.status}</div>
                <button onclick="closeView()" class="close-btn">&times;</button>
            </div>
        </div>

        <div class="dash-body">
            <div class="dash-grid">
                <div class="info-card">
                    <h3><i class="fas fa-info-circle"></i> CLIENT INFORMATION</h3>
                    <div class="detail-row"><span>Location:</span> <b>${c.location}</b></div>
                    <div class="detail-row"><span>Occupation:</span> <b>${c.occupation}</b></div>
                    <div class="detail-row"><span>Referral:</span> <b>${c.referral}</b></div>
                    <div class="detail-row"><span>Phone:</span> <b>${c.phone}</b></div>
                </div>

                <div class="info-card">
                    <h3><i class="fas fa-money-bill-wave"></i> CURRENT LOANS</h3>
                    <div class="loan-box">Principal: <b>KSH ${c.principal}</b></div>
                    <div class="loan-box">Total Paid: <b>KSH ${c.totalPaid}</b></div>
                    <div class="loan-box">Balance: <b class="text-danger">KSH ${c.balance}</b></div>
                    <div class="loan-box">Next Payment: <b>${c.nextPayment || 'Not Set'}</b></div>
                </div>

                <div class="info-card">
                    <h3><i class="fas fa-user-tie"></i> MANAGEMENT</h3>
                    <label>Status</label>
                    <select id="newStatus"><option value="Active" ${c.status=='Active'?'selected':''}>Active</option><option value="Inactive" ${c.status=='Inactive'?'selected':''}>Inactive</option></select>
                    <label>Loan Officer</label>
                    <input type="text" id="newOfficer" value="${c.loanOfficer || ''}">
                </div>
            </div>

            <div class="info-card full-w">
                <h3>NOTES & REMINDERS</h3>
                <textarea id="note-input" placeholder="Add a specific note about this client...">${c.notes || ''}</textarea>
                <button class="btn-post" onclick="saveClientChanges()">Save Notes & Info</button>
            </div>

            <div class="info-card full-w">
                <h3>PAYMENT HISTORY</h3>
                <table class="mini-table">
                    <thead><tr><th>Date</th><th>Activity</th><th>Details</th><th>Time (Filled)</th><th>By</th></tr></thead>
                    <tbody>${renderHistoryRows(c.history)}</tbody>
                </table>
            </div>

            <div class="info-card full-w">
                <h3>ARCHIVED LOANS (CLEARED)</h3>
                <table class="mini-table">
                    <thead><tr><th>Amount</th><th>Date Cleared</th></tr></thead>
                    <tbody>${(c.archives || []).map(a => `<tr><td>KSH ${a.amt}</td><td>${a.date}</td></tr>`).join('')}</tbody>
                </table>
            </div>

            <div class="action-footer">
                <div class="action-input"><label>Amount</label><input type="number" id="act-amt"></div>
                <div class="action-input"><label>Time (Manual)</label><input type="time" id="act-time"></div>
                <button class="btn-post" onclick="processPayment('Payment')">Post Payment</button>
                <button class="btn-settle" onclick="processPayment('Settle')">Settle Loan</button>
                <button class="btn-new" onclick="processPayment('New')">New Loan</button>
                <button class="btn-delete" onclick="processPayment('Delete')">Delete Profile</button>
            </div>
        </div>
    `;
    document.getElementById('view-modal').classList.remove('hidden');
};

// --- 3. LOGIC FOR COLORS (6PM & SKIPS) ---
function renderHistoryRows(history = []) {
    return history.map(h => {
        // Condition: Highlight red if time entered is past 18:00 (6 PM)
        const isLate = h.time > "18:00";
        // Condition: Highlight blue if it's a "New Loan" start
        const isNew = h.activity === "New Loan";
        
        return `<tr class="${isLate ? 'row-red' : ''} ${isNew ? 'row-blue' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');
}

// --- 4. SATURDAY LOGIC (LOANS SIDEBAR) ---
window.filterSaturdays = () => {
    const month = document.getElementById('l-month').value;
    const week = parseInt(document.getElementById('l-week').value);
    
    const filtered = allClients.filter(c => {
        const d = new Date(c.startDate);
        const isSat = d.getDay() === 6;
        const correctMonth = c.startDate.startsWith(month);
        const weekNum = Math.ceil(d.getDate() / 7);
        return isSat && correctMonth && weekNum === week;
    });

    document.getElementById('saturdayTableBody').innerHTML = filtered.map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>KSH ${c.principal}</td><td>${c.startDate}</td></tr>
    `).join('');
};

// --- 5. FINANCIALS (AUTOMATIC) ---
function calculateFinancials() {
    let grandOut = 0, todayPaid = 0;
    const today = new Date().toLocaleDateString();

    allClients.forEach(c => {
        grandOut += (c.balance || 0);
        (c.history || []).forEach(h => {
            if(h.date === today && h.activity === 'Payment') {
                todayPaid += parseFloat(h.details.replace('KSH ', '')) || 0;
            }
        });
    });

    document.getElementById('finance-cards').innerHTML = `
        <div class="stat-card"><h3>Grand Total Out</h3><h2>KSH ${grandOut}</h2></div>
        <div class="stat-card"><h3>Paid Today</h3><h2>KSH ${todayPaid}</h2></div>
        `;
}

// --- 6. CORE ACTIONS (PROMPTS) ---
window.processPayment = async (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const client = allClients.find(x => x.idNumber == activeID);

    if(type === 'Payment') {
        const newPaid = client.totalPaid + amt;
        const newHistory = [...(client.history || []), {
            date: new Date().toLocaleDateString(),
            activity: 'Payment',
            details: `KSH ${amt}`,
            time: time,
            by: auth.currentUser.email
        }];
        await update(ref(db, `jml_data/${activeID}`), {
            totalPaid: newPaid,
            balance: client.principal - newPaid,
            history: newHistory,
            lastUpdated: new Date().toLocaleString()
        });
    } else if (type === 'Settle') {
        const archived = { amt: client.principal, date: new Date().toLocaleDateString() };
        await update(ref(db, `jml_data/${activeID}`), {
            status: 'Settled',
            balance: 0,
            archives: [...(client.archives || []), archived]
        });
    } else if (type === 'Delete') {
        await remove(ref(db, `jml_data/${activeID}`));
        closeView();
    }
    openView(activeID); // Refresh dashboard
};

// --- 7. UI HELPERS ---
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth < 768) toggleSidebar();
};
window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};
window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: princ, balance: princ, totalPaid: 0, 
        startDate: document.getElementById('e-start').value, endDate: document.getElementById('e-end').value,
        status: "Active", history: [{date: new Date().toLocaleDateString(), activity: 'New Loan', details: `KSH ${princ}`, time: '09:00', by: auth.currentUser.email}]
    };
    await set(ref(db, `jml_data/${id}`), data);
    showSection('list-sec');
};
window.renderMainTable = () => {
    document.getElementById('clientTableBody').innerHTML = allClients.map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>KSH ${c.totalPaid}</td><td>KSH ${c.balance}</td>
        <td><button class="btn-post" onclick="openView('${c.idNumber}')">View</button></td></tr>
    `).join('');
};
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());

