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
});

// NAVIGATION
function switchTab(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function toggleTheme() { document.body.classList.toggle('dark-mode'); }

// ENROLL & IMMEDIATE REFRESH
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id) return alert("ID Required");

    const data = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', officer: 'Unassigned',
        lastUpdated: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + id).set(data).then(() => {
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        switchTab('list-sec', document.querySelector('.nav-item:first-child'));
    });
}

// RENDER MAIN TABLE
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

// OPEN VIEW DOSSIER
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    switchTab('view-sec');
    
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = (c.principal - (c.totalPaid || 0));
    document.getElementById('v-last-up').innerText = c.lastUpdated;

    renderHistory(c);
}

// HISTORY LOGIC (Late payments & New Loans)
function renderHistory(c) {
    const body = document.getElementById('v-history-body');
    if(!c.history) { body.innerHTML = ''; return; }
    
    body.innerHTML = Object.values(c.history).map(h => {
        const lateClass = h.time > "18:00" ? 'late-payment' : '';
        const newClass = h.activity === 'New Loan' ? 'new-loan-row' : '';
        return `<tr class="${lateClass} ${newClass}"><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>Admin</td></tr>`;
    }).join('');
}

// ACTIONS WITH PROMPTS
function recordPayment() {
    if(!confirm("Are you sure you want to record this payment?")) return;
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const c = clients.find(x => x.key === activeKey);
    
    const newPaid = (c.totalPaid || 0) + amt;
    db.ref(`jml_master_records/${activeKey}`).update({
        totalPaid: newPaid,
        lastUpdated: new Date().toLocaleString()
    });
    db.ref(`jml_master_records/${activeKey}/history`).push({
        date: new Date().toLocaleDateString(),
        activity: 'Payment',
        amt: amt,
        time: time,
        details: document.getElementById('act-details').value
    });
}
