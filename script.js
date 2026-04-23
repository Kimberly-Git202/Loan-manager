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

// Real-time Data Sync
db.ref('jml_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainTable();
    calcFinancials();
});

// Enrollment
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Fill ID and Principal");

    const payload = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, balance: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', history: [], archive: []
    };

    db.ref('jml_records/' + id).set(payload).then(() => alert("Enrolled!"));
};

// View Detail
window.openView = (key) => {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    document.getElementById('v-name-title').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNo;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-bal').innerText = c.balance;
    document.getElementById('v-paid').innerText = c.totalPaid;
    
    renderHistory(c.history);
    document.getElementById('view-panel').classList.add('open');
};

function renderHistory(history) {
    const body = document.getElementById('v-history');
    body.innerHTML = (history || []).map(h => {
        const isLate = h.time > "18:00" ? 'late-payment' : '';
        const isNew = h.activity === 'New Loan' ? 'new-loan-row' : '';
        return `<tr class="${isLate} ${isNew}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>Admin</td>
        </tr>`;
    }).join('');
}

// Processing Actions with Prompts
window.processAction = (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;
    const c = clients.find(x => x.key === activeKey);

    let updates = {};
    const entry = { date: new Date().toLocaleDateString(), activity: type, time: time, details: `Amount: ${amt}` };

    if(type === 'Payment') {
        updates.totalPaid = c.totalPaid + amt;
        updates.balance = c.balance - amt;
    } else if(type === 'Settle') {
        updates.balance = 0;
        updates.status = 'Inactive';
        updates.archive = [...(c.archive || []), { amount: c.principal, date: new Date().toLocaleDateString() }];
    }

    db.ref('jml_records/' + activeKey).update(updates);
    db.ref(`jml_records/${activeKey}/history`).push(entry);
};

window.toggleTheme = () => document.body.classList.toggle('dark-mode');

window.showSec = (id, el) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};

function calcFinancials() {
    let out = 0, today = 0;
    clients.forEach(c => {
        out += parseFloat(c.principal || 0);
        // Add logic for filtering today/month here
    });
    document.getElementById('f-total-out').innerText = "KSH " + out;
}

window.closeView = () => document.getElementById('view-panel').classList.remove('open');

function renderMainTable() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = clients.map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td>
        <td>${c.totalPaid}</td><td>${c.balance}</td>
        <td><button class="btn btn-main" onclick="openView('${c.key}')">VIEW</button></td></tr>
    `).join('');
}
