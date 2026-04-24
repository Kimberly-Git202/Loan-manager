// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let clients = [];
let debts = [];
let activeKey = null;

// --- REAL-TIME DATA SYNC ---
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainList();
    runCalculations();
});

db.ref('jml_manual_debts').on('value', snap => {
    const data = snap.val();
    debts = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderDebts();
});

// --- NAVIGATION ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('minimized'); }
function showSec(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}

// --- ENROLLMENT LOGIC ---
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Error: ID Number and Principal are required.");

    const clientData = {
        name: document.getElementById('e-name').value,
        idNo: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        totalPaid: 0,
        balance: princ,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active',
        lastUpdated: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + id).set(clientData).then(() => {
        alert("Enrolled Successfully!");
        // Immediate Clear and Switch
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        showSec('list-sec');
    });
}

// --- RENDERING LOGIC ---
function renderMainList() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid.toLocaleString()}</td>
            <td class="text-red">KSH ${(c.principal - c.totalPaid).toLocaleString()}</td>
            <td><button class="btn btn-p btn-sm" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    showSec('view-sec');

    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-last-up').innerText = c.lastUpdated;
    document.getElementById('v-status-select').value = c.status;

    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-info-occ').innerText = c.occupation;
    document.getElementById('v-info-ref').innerText = c.referral;

    document.getElementById('v-princ').innerText = c.principal.toLocaleString();
    document.getElementById('v-paid').innerText = c.totalPaid.toLocaleString();
    document.getElementById('v-bal').innerText = (c.principal - c.totalPaid).toLocaleString();
    document.getElementById('v-next').innerText = c.nextDue || '--';
    
    document.getElementById('v-notes').value = c.notes || '';
    renderHistory(c);
}

function renderHistory(c) {
    const body = document.getElementById('v-history-body');
    if(!c.history) { body.innerHTML = ''; return; }
    
    body.innerHTML = Object.values(c.history).map(h => {
        // Late highlight (Past 6 PM)
        const isLate = h.time > "18:00" ? 'late-row' : '';
        return `<tr class="${isLate}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.handledBy || 'Admin'}</td>
        </tr>`;
    }).join('');
}

// --- CLIENT ACTIONS ---
function recordPayment() {
    if(!confirm("Post this payment?")) return;
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const details = document.getElementById('act-details').value;
    if(!amt || !time) return alert("Fill all fields.");

    const c = clients.find(x => x.key === activeKey);
    const newPaid = (c.totalPaid || 0) + amt;

    const record = {
        date: new Date().toLocaleDateString(),
        activity: 'Payment',
        details: `Paid KSH ${amt}. Next: ${details}`,
        time: time,
        handledBy: 'Admin'
    };

    db.ref(`jml_master_records/${activeKey}`).update({
        totalPaid: newPaid,
        nextDue: details,
        lastUpdated: new Date().toLocaleString()
    });
    db.ref(`jml_master_records/${activeKey}/history`).push(record);
    document.getElementById('act-amt').value = '';
}

function settleLoan() {
    if(!confirm("Settle this account?")) return;
    const c = clients.find(x => x.key === activeKey);
    db.ref(`jml_master_records/${activeKey}/archives`).push({ amount: c.principal, dateCleared: new Date().toLocaleDateString() });
    db.ref(`jml_master_records/${activeKey}`).update({ principal: 0, totalPaid: 0, status: 'Inactive' });
}

function deleteProfile() {
    if(confirm("Permanently delete profile?")) {
        db.ref(`jml_master_records/${activeKey}`).remove().then(() => showSec('list-sec'));
    }
}

// --- FINANCIALS ---
function runCalculations() {
    let out = 0;
    clients.forEach(c => out += parseFloat(c.principal || 0));
    document.getElementById('f-total-out').innerText = "KSH " + out.toLocaleString();
}

// Initializer
(function init() {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mSel = document.getElementById('f-month-sel');
    months.forEach((m, i) => mSel.innerHTML += `<option value="${i+1}">${m} 2026</option>`);
})();
