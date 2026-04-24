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
    calcFinance();
});

// NAVIGATION & THEME
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function switchTab(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
    if(window.innerWidth < 900) toggleSidebar();
}
function toggleTheme() { document.body.classList.toggle('dark-mode'); }

// ENROLL (IMMEDIATE UPDATE)
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("ID and Principal required");

    const data = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', lastUpdated: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + id).set(data).then(() => {
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        switchTab('list-sec');
    });
}

// MAIN RENDER
function renderMainList() {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td>
            <td class="text-red">KSH ${(c.principal - (c.totalPaid || 0))}</td>
            <td><button class="btn btn-p btn-sm" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

// FINANCIALS
function calcFinance() {
    let out = 0, today = 0;
    const now = new Date().toLocaleDateString();
    clients.forEach(c => {
        out += parseFloat(c.principal || 0);
        if(c.history) {
            Object.values(c.history).forEach(h => {
                if(h.date === now) today += parseFloat(h.amt || 0);
            });
        }
    });
    document.getElementById('f-total-out').innerText = out;
    document.getElementById('f-paid-today').innerText = today;
}

// VIEW DOSSIER
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    switchTab('view-sec');
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = (c.principal - (c.totalPaid || 0));
    renderHistory(c);
}

function renderHistory(c) {
    const body = document.getElementById('v-history-body');
    if(!c.history) { body.innerHTML = ''; return; }
    body.innerHTML = Object.values(c.history).map(h => {
        const late = h.time > "18:00" ? 'late-row' : '';
        const newL = h.activity === 'New Loan' ? 'new-loan-row' : '';
        return `<tr class="${late} ${newL}"><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td></tr>`;
    }).join('');
}

// ACTIONS
function recordPayment() {
    if(!confirm("Post payment?")) return;
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const c = clients.find(x => x.key === activeKey);
    const newPaid = (c.totalPaid || 0) + amt;
    
    db.ref(`jml_master_records/${activeKey}`).update({ totalPaid: newPaid });
    db.ref(`jml_master_records/${activeKey}/history`).push({
        date: new Date().toLocaleDateString(),
        activity: 'Payment',
        amt: amt,
        time: time,
        by: 'Admin'
    });
}
