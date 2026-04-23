// Initialization
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let clients = [];
let activeKey = null;

// Real-time listener
db.ref('jml_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainTable();
    calcFinancials();
    renderSaturdayLoans();
});

// Sidebar & Theme
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};

// Enrollment
window.enrollClient = () => {
    const name = document.getElementById('e-name').value;
    const idNo = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);

    if(!name || !idNo || isNaN(princ)) return alert("Please fill all required fields!");

    const payload = {
        name, idNo, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, balance: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', notes: "", 
        history: [{ date: new Date().toLocaleDateString(), activity: 'Enrollment', details: `Loan Issued: ${princ}`, time: '08:00', by: 'System' }],
        archive: []
    };

    db.ref('jml_records/' + idNo).set(payload).then(() => {
        alert("Enrolled Successfully");
        document.querySelectorAll('.enroll-card input').forEach(i => i.value = "");
    });
};

// View Detailed Panel
window.openView = (key) => {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    
    document.getElementById('v-name-title').innerText = c.name;
    document.getElementById('v-id-title').innerText = c.idNo;
    document.getElementById('v-last-up').innerText = c.lastUpdated || "New";
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNo;
    document.getElementById('v-phone').innerText = c.phone;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.balance;
    document.getElementById('v-next-txt').innerText = c.nextDue || "Not set";
    document.getElementById('v-notes').value = c.notes || "";
    document.getElementById('v-status-select').value = c.status;
    document.getElementById('v-officer').value = c.officer || "";
    document.getElementById('v-start-edit').value = c.startDate || "";
    document.getElementById('v-end-edit').value = c.endDate || "";

    renderHistoryTable(c.history);
    renderArchiveTable(c.archive);
    document.getElementById('view-panel').classList.add('open');
};

function renderHistoryTable(history) {
    const body = document.getElementById('v-history-body');
    body.innerHTML = (history || []).map(h => {
        // Late highlight (> 18:00)
        const isLate = h.time > "18:00";
        const isNewLoan = h.activity.includes('NEW LOAN');
        return `<tr class="${isLate ? 'late-row' : ''} ${isNewLoan ? 'new-loan-start' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');
}

// Processing Actions with Confirmation Prompts
window.processAction = (type) => {
    if(!confirm(`Are you sure you want to proceed with: ${type}?`)) return;
    
    const c = clients.find(x => x.key === activeKey);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const next = document.getElementById('act-next').value;
    
    let update = { lastUpdated: new Date().toLocaleString() };

    if(type === 'Payment') {
        update.totalPaid = c.totalPaid + amt;
        update.balance = c.balance - amt;
        update.nextDue = next;
        update.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'Payment', details: `Received ${amt}`, time: time, by: 'Admin' }];
    } 
    else if(type === 'Settle') {
        const cleared = { amount: c.principal, clearedDate: new Date().toLocaleDateString() };
        update.archive = [...(c.archive || []), cleared];
        update.balance = 0; update.status = 'Inactive';
        update.history = [...(c.history || []), { date: new Date().toLocaleDateString(), activity: 'SETTLED', details: 'Loan cleared', time: time, by: 'Admin' }];
    }
    else if(type === 'Delete') {
        db.ref('jml_records/' + activeKey).remove().then(closeView);
        return;
    }

    db.ref('jml_records/' + activeKey).update(update);
};

window.closeView = () => document.getElementById('view-panel').classList.remove('open');

function renderMainTable() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td>
            <td>${c.totalPaid}</td><td>${c.balance}</td>
            <td><button class="btn btn-main" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

// Financials Logic
function calcFinancials() {
    const totalOut = clients.reduce((acc, c) => acc + (parseFloat(c.principal) || 0), 0);
    document.getElementById('f-total-out').innerText = `KSH ${totalOut}`;
}

// Search
window.filterClients = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientsTableBody tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
};

// Saturday Logic
function populateSelectors() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const mSel = document.getElementById('loan-month');
    const fSel = document.getElementById('f-month-sel');
    months.forEach(m => {
        let opt = document.createElement('option'); opt.text = m;
        mSel.add(opt); 
        let opt2 = document.createElement('option'); opt2.text = m;
        fSel.add(opt2);
    });
}
populateSelectors();
