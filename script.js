// --- FIREBASE INITIALIZATION ---
// (Config remains as provided)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let clients = [];
let debts = [];
let activeKey = null;

// --- REAL-TIME LISTENERS ---
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainList(); // UPDATES IMMEDIATELY
    runCalculations();
});

db.ref('jml_manual_debts').on('value', snap => {
    const data = snap.val();
    debts = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderDebts();
});

// --- CORE FUNCTIONS ---
function showSec(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}

// ENROLL CLIENT
function enrollClient() {
    const idNo = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!idNo || isNaN(princ)) return alert("Please fill ID and Principal.");

    const newClient = {
        name: document.getElementById('e-name').value,
        idNo: idNo,
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
        officer: 'Unassigned',
        lastUpdated: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + idNo).set(newClient).then(() => {
        alert("Enrolled Successfully");
        // CLEAR FORM
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        showSec('list-sec'); // RETURN TO LIST IMMEDIATELY
    });
}

// RENDER MAIN LIST
function renderMainList() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid.toLocaleString()}</td>
            <td class="text-red">KSH ${(c.principal - c.totalPaid).toLocaleString()}</td>
            <td><button class="btn btn-p btn-sm" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

// OPEN CLIENT VIEW (DOSSIER)
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    showSec('view-sec');

    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-last-up').innerText = c.lastUpdated || '--';
    
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-info-occ').innerText = c.occupation;
    document.getElementById('v-info-ref').innerText = c.referral;

    document.getElementById('v-princ').innerText = c.principal.toLocaleString();
    document.getElementById('v-paid').innerText = c.totalPaid.toLocaleString();
    document.getElementById('v-bal').innerText = (c.principal - c.totalPaid).toLocaleString();
    
    document.getElementById('v-status-select').value = c.status;
    document.getElementById('v-officer-input').value = c.officer || '';
    document.getElementById('v-notes').value = c.notes || '';
    document.getElementById('v-start-edit').value = c.startDate || '';
    document.getElementById('v-end-edit').value = c.endDate || '';

    renderHistory(c);
}

// RENDER HISTORY WITH LATE HIGHLIGHTING
function renderHistory(c) {
    const hBody = document.getElementById('v-history-body');
    if(!c.history) { hBody.innerHTML = ''; return; }
    
    hBody.innerHTML = Object.values(c.history).map(h => {
        // Late highlight: if time > 18:00 (6 PM)
        const isLate = h.time && h.time > "18:00" ? 'late-payment' : '';
        const isNewLoan = h.activity === 'New Loan' ? 'new-loan-row' : '';
        
        return `<tr class="${isLate} ${isNewLoan}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.handledBy}</td>
        </tr>`;
    }).join('');
}

// PROCESS PAYMENT
function processPayment() {
    if(!confirm("Are you sure you want to post this payment?")) return;
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const details = document.getElementById('act-details').value;
    
    if(!amt || !time) return alert("Fill Amount and Time");

    const c = clients.find(x => x.key === activeKey);
    const newPaid = (c.totalPaid || 0) + amt;
    
    const hist = {
        date: new Date().toLocaleDateString(),
        activity: 'Payment',
        details: `KSH ${amt} Paid. Next: ${details}`,
        time: time,
        handledBy: 'Admin'
    };

    db.ref(`jml_master_records/${activeKey}`).update({
        totalPaid: newPaid,
        lastUpdated: new Date().toLocaleString(),
        balance: c.principal - newPaid
    });
    db.ref(`jml_master_records/${activeKey}/history`).push(hist);
}

// SETTLE LOAN
function settleLoan() {
    if(!confirm("Are you sure this loan is fully cleared?")) return;
    const c = clients.find(x => x.key === activeKey);
    
    const archive = {
        amount: c.principal,
        dateCleared: new Date().toLocaleDateString()
    };

    db.ref(`jml_master_records/${activeKey}/archives`).push(archive);
    db.ref(`jml_master_records/${activeKey}`).update({
        principal: 0,
        totalPaid: 0,
        status: 'Inactive'
    });
}

// MANUAL DEBTS
function addManualDebt() {
    const name = document.getElementById('d-name').value;
    const id = document.getElementById('d-id').value;
    const amt = document.getElementById('d-bal').value;
    if(!name || !amt) return alert("Fill Name and Balance");

    db.ref('jml_manual_debts').push({ name, idNo: id, principal: document.getElementById('d-princ').value, balance: amt });
}

function renderDebts() {
    document.getElementById('debt-body').innerHTML = debts.map(d => `
        <tr>
            <td>${d.name}</td><td>${d.idNo}</td><td>${d.principal}</td><td>${d.balance}</td>
            <td><button class="btn btn-red btn-sm" onclick="clearDebt('${d.key}')">CLEAR</button></td>
        </tr>
    `).join('');
}

function clearDebt(key) {
    if(confirm("Clear this debt record?")) db.ref('jml_manual_debts/' + key).remove();
}

// CALCULATIONS
function runCalculations() {
    let out = 0, today = 0;
    clients.forEach(c => {
        out += (c.principal || 0);
    });
    document.getElementById('f-total-out').innerText = "KSH " + out.toLocaleString();
}

// Initialize Year/Month Dropdowns
(function init() {
    const mSel = document.getElementById('f-month-sel');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach((m, i) => mSel.innerHTML += `<option value="${i}">${m}</option>`);
})();
