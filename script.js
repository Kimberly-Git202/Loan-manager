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

// SYNC DATA
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainList();
    runCalculations();
});

// SIDEBAR & THEMES
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};

// ENROLL CLIENT
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Required: ID Number and Principal.");

    const payload = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, balance: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', history: [], archive: [], notes: []
    };

    db.ref('jml_master_records/' + id).set(payload).then(() => {
        alert("Client Enrolled Successfully!");
    });
};

// VIEW PANEL LOGIC
window.openView = (key) => {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-princ').innerText = `KSH ${c.principal}`;
    document.getElementById('v-paid').innerText = `KSH ${c.totalPaid || 0}`;
    document.getElementById('v-bal').innerText = `KSH ${c.balance}`;
    document.getElementById('v-status').value = c.status;
    document.getElementById('v-officer').value = c.officer || "";
    
    renderHistory(c.history);
    renderArchives(c.archive);
    document.getElementById('view-panel').classList.add('open');
};

function renderHistory(history) {
    const body = document.getElementById('v-history-body');
    const histArray = history ? Object.values(history) : [];
    body.innerHTML = histArray.map(h => {
        const isLate = h.time > "18:00"; // Red highlight logic
        const isNew = h.activity === 'New Loan'; // Green highlight logic
        return `<tr class="${isLate ? 'late-row' : ''} ${isNew ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>Admin</td>
        </tr>`;
    }).join('');
}

// ACTIONS WITH CONFIRMATION
window.process = (type) => {
    if(!confirm(`Confirm ${type} action?`)) return;

    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const next = document.getElementById('act-next').value;
    const c = clients.find(x => x.key === activeKey);

    let updates = { lastUpdated: new Date().toLocaleString() };

    if(type === 'Payment') {
        updates.totalPaid = (c.totalPaid || 0) + amt;
        updates.balance = c.balance - amt;
        updates.nextDue = next;
    } else if(type === 'Settle') {
        const arch = { amount: c.principal, date: new Date().toLocaleDateString() };
        updates.archive = [...(c.archive || []), arch];
        updates.balance = 0; updates.status = 'Inactive';
    } else if(type === 'Delete') {
        db.ref('jml_master_records/' + activeKey).remove().then(closeView); return;
    }

    db.ref('jml_master_records/' + activeKey).update(updates);
    db.ref(`jml_master_records/${activeKey}/history`).push({
        date: new Date().toLocaleDateString(), activity: type, details: `KSH ${amt}`, time: time
    });
};

// CALCULATIONS
function runCalculations() {
    let out = 0, today = 0;
    clients.forEach(c => {
        out += parseFloat(c.principal || 0);
        // Calculation logic for today's payments
        if(c.history) {
            Object.values(c.history).forEach(h => {
                if(h.date === new Date().toLocaleDateString()) today += parseFloat(h.details.replace('KSH ', '')) || 0;
            });
        }
    });
    document.getElementById('f-total-out').innerText = `KSH ${out.toLocaleString()}`;
    document.getElementById('f-paid-today').innerText = `KSH ${today.toLocaleString()}`;
}

window.closeView = () => document.getElementById('view-panel').classList.remove('open');
function renderMainList() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = clients.map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td>
        <td>${c.totalPaid || 0}</td><td>${c.balance}</td>
        <td><button class="btn btn-p" onclick="openView('${c.key}')">VIEW</button></td></tr>
    `).join('');
}
