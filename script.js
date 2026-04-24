// --- FIREBASE INIT ---
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
    renderMainList(); // Updates list immediately
    runCalculations();
});

db.ref('jml_manual_debts').on('value', snap => {
    const data = snap.val();
    debts = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderDebts();
});

// --- NAVIGATION ---
function showSec(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}

// --- CLIENT ENROLLMENT ---
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Error: ID and Principal are required.");

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
        lastUpdated: new Date().toLocaleString(),
        officer: 'Unassigned'
    };

    db.ref('jml_master_records/' + id).set(clientData).then(() => {
        alert("Client Enrolled Successfully!");
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        showSec('list-sec'); // Jump back to table
    });
}

// --- RENDER MAIN TABLE ---
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

// --- VIEW CLIENT (DOSSIER) ---
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    showSec('view-sec');

    // Headers
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-last-up').innerText = c.lastUpdated;
    
    // Status & Officer
    document.getElementById('v-status-select').value = c.status;
    document.getElementById('v-officer-input').value = c.officer || '';

    // Info
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-info-occ').innerText = c.occupation;
    document.getElementById('v-info-ref').innerText = c.referral;

    // Financials
    document.getElementById('v-princ').innerText = c.principal.toLocaleString();
    document.getElementById('v-paid').innerText = c.totalPaid.toLocaleString();
    document.getElementById('v-bal').innerText = (c.principal - c.totalPaid).toLocaleString();
    document.getElementById('v-next').innerText = c.nextDue || 'Not Set';
    
    document.getElementById('v-start-edit').value = c.startDate || '';
    document.getElementById('v-end-edit').value = c.endDate || '';
    document.getElementById('v-notes-area').value = c.notes || '';

    renderHistory(c);
}

function renderHistory(c) {
    const hBody = document.getElementById('v-history-body');
    if(!c.history) { hBody.innerHTML = '<tr><td colspan="5">No history found</td></tr>'; return; }
    
    hBody.innerHTML = Object.values(c.history).map(h => {
        // Red highlight if payment is past 6:00 PM (18:00)
        const isLate = h.time > "18:00" ? 'late-row' : '';
        const isNew = h.activity === 'New Loan' ? 'new-loan-marker' : '';
        return `<tr class="${isLate} ${isNew}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.handledBy || 'Admin'}</td>
        </tr>`;
    }).join('');
}

// --- ACTIONS WITH PROMPTS ---
function recordPayment() {
    if(!confirm("Are you sure you want to post this payment?")) return;
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const details = document.getElementById('act-details').value;
    if(!amt || !time) return alert("Fill amount and time.");

    const c = clients.find(x => x.key === activeKey);
    const newTotal = (c.totalPaid || 0) + amt;

    const record = {
        date: new Date().toLocaleDateString(),
        activity: 'Payment',
        details: `Paid KSH ${amt}. Next: ${details}`,
        time: time,
        handledBy: 'JML_User'
    };

    db.ref(`jml_master_records/${activeKey}`).update({
        totalPaid: newTotal,
        nextDue: details,
        lastUpdated: new Date().toLocaleString()
    });
    db.ref(`jml_master_records/${activeKey}/history`).push(record);
    document.getElementById('act-amt').value = '';
}

function settleLoanPrompt() {
    if(!confirm("Confirm Full Settlement? This will archive the current loan.")) return;
    const c = clients.find(x => x.key === activeKey);
    const archive = { amount: c.principal, dateCleared: new Date().toLocaleDateString() };
    
    db.ref(`jml_master_records/${activeKey}/archives`).push(archive);
    db.ref(`jml_master_records/${activeKey}`).update({ principal: 0, totalPaid: 0, status: 'Inactive' });
}

function deleteProfilePrompt() {
    if(confirm("PERMANENT DELETE? This cannot be undone.")) db.ref(`jml_master_records/${activeKey}`).remove().then(() => showSec('list-sec'));
}

// --- DEBTS ---
function addManualDebt() {
    const d = { 
        name: document.getElementById('d-name').value, 
        idNo: document.getElementById('d-id').value, 
        principal: document.getElementById('d-princ').value, 
        balance: document.getElementById('d-bal').value 
    };
    db.ref('jml_manual_debts').push(d);
}

function renderDebts() {
    document.getElementById('debt-body').innerHTML = debts.map(d => `
        <tr><td>${d.name}</td><td>${d.idNo}</td><td>${d.principal}</td><td>${d.balance}</td>
        <td><button class="btn btn-red btn-sm" onclick="if(confirm('Clear debt?')) db.ref('jml_manual_debts/${d.key}').remove()">CLEAR</button></td></tr>
    `).join('');
}

// --- FINANCE LOGIC ---
function runCalculations() {
    let grandOut = 0;
    clients.forEach(c => grandOut += parseFloat(c.principal || 0));
    document.getElementById('f-total-out').innerText = "KSH " + grandOut.toLocaleString();
}

// Init logic for dropdowns
(function populateDates() {
    const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mSel = document.getElementById('f-month-sel');
    m.forEach((name, i) => mSel.innerHTML += `<option value="${i+1}">${name} 2026</option>`);
})();
