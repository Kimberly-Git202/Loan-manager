// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let allClients = [];
let activeID = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    populateMonthSelectors();
});

function fetchData() {
    db.ref('jml_data').on('value', snap => {
        const val = snap.val();
        allClients = val ? Object.keys(val).map(key => ({ key, ...val[key] })) : [];
        renderClientTable();
    });
}

// Navigation
window.showSec = (id, el) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');

// Enrollment
window.enrollClient = () => {
    const idNum = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    
    if(!idNum || isNaN(princ)) return alert("Fill ID and Principal!");

    const data = {
        name: document.getElementById('e-name').value,
        idNumber: idNum,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        balance: princ,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active',
        history: [{ date: new Date().toLocaleDateString(), activity: 'Enrollment', details: `Started with KSH ${princ}`, time: '--', by: 'Admin' }],
        archive: [],
        notes: ""
    };

    db.ref('jml_data/' + idNum).set(data).then(() => {
        alert("Client Enrolled!");
        resetForm();
    });
};

// Client Detailed View
window.openView = (key) => {
    activeID = key;
    const c = allClients.find(x => x.key === key);
    
    document.getElementById('v-name-title').innerText = c.name;
    document.getElementById('v-id-title').innerText = c.idNumber;
    document.getElementById('v-last-up').innerText = c.lastUpdated || "Never";
    document.getElementById('v-status-select').value = c.status;
    document.getElementById('v-officer').value = c.officer || "";

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-phone').innerText = c.phone;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;

    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.balance;
    document.getElementById('v-next-txt').innerText = c.nextDue || "No schedule";
    document.getElementById('v-notes').value = c.notes || "";

    renderHistory(c);
    renderArchive(c);
    document.getElementById('view-panel').classList.add('open');
};

function renderHistory(c) {
    const body = document.getElementById('v-history-body');
    body.innerHTML = (c.history || []).map(h => {
        const isLate = h.time > "18:00";
        const isNew = h.activity === 'NEW LOAN';
        return `<tr class="${isLate ? 'late-row' : ''} ${isNew ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');
}

function renderArchive(c) {
    const body = document.getElementById('v-archive-body');
    body.innerHTML = (c.archive || []).map(a => `
        <tr><td>KSH ${a.amount}</td><td>${a.clearedDate}</td></tr>
    `).join('');
}

// Processing Actions
window.processAction = (type) => {
    if(!confirm(`Are you sure you want to process: ${type}?`)) return;
    
    const c = allClients.find(x => x.key === activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const timeVal = document.getElementById('act-time').value;
    const nextDue = document.getElementById('act-next').value;
    
    let update = { lastUpdated: new Date().toLocaleString() };

    if(type === 'Payment') {
        update.totalPaid = c.totalPaid + amt;
        update.balance = c.balance - amt;
        update.nextDue = nextDue;
        update.history = [...(c.history || []), {
            date: new Date().toLocaleDateString(), activity: 'Payment', details: `Paid KSH ${amt}`, time: timeVal, by: 'Admin'
        }];
    } 
    else if(type === 'Settle') {
        const archivedLoan = { amount: c.principal, clearedDate: new Date().toLocaleDateString() };
        update.archive = [...(c.archive || []), archivedLoan];
        update.balance = 0;
        update.status = 'Inactive';
        update.history = [...(c.history || []), {
            date: new Date().toLocaleDateString(), activity: 'SETTLED', details: 'Full Clearance', time: timeVal, by: 'Admin'
        }];
    }
    else if(type === 'Delete') {
        db.ref('jml_data/' + activeID).remove().then(closeView);
        return;
    }

    db.ref('jml_data/' + activeID).update(update).then(() => {
        alert("Updated Successfully");
        openView(activeID);
    });
};

window.saveNotes = () => {
    const n = document.getElementById('v-notes').value;
    db.ref('jml_data/' + activeID).update({ notes: n }).then(() => alert("Note Saved"));
};

window.closeView = () => document.getElementById('view-panel').classList.remove('open');

// Rendering Tables
function renderClientTable() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = allClients.map((c, i) => `
        <tr>
            <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
            <td>${c.totalPaid}</td><td>${c.balance}</td>
            <td><button class="btn btn-main" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

function populateMonthSelectors() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const sel = document.getElementById('f-month-sel');
    months.forEach(m => {
        let opt = document.createElement('option');
        opt.text = m + " 2026";
        sel.add(opt);
    });
}
