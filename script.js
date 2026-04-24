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
let activeKey = null;

// --- REAL-TIME DATA SYNC ---
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    // Convert to array and update immediately
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainTable();
});

// --- NAVIGATION ---
function switchTab(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// --- ENROLL CLIENT (IMMEDIATE UPDATE) ---
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Required: ID and Principal");

    const newClient = {
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

    db.ref('jml_master_records/' + id).set(newClient).then(() => {
        // Form disappears immediately
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        switchTab('list-sec'); // Switch to table immediately
    });
}

// --- RENDER MAIN TABLE ---
function renderMainTable() {
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

// --- OPEN VIEW (DOSSIER) ---
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    switchTab('view-sec');

    // Header Details
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-last-up').innerText = c.lastUpdated;
    document.getElementById('v-status-select').value = c.status;

    // Info Boxes
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-info-occ').innerText = c.occupation;
    document.getElementById('v-info-ref').innerText = c.referral;

    // Loan Boxes
    document.getElementById('v-princ').innerText = c.principal.toLocaleString();
    document.getElementById('v-paid').innerText = c.totalPaid.toLocaleString();
    document.getElementById('v-bal').innerText = (c.principal - c.totalPaid).toLocaleString();
    document.getElementById('v-next').innerText = c.nextDue || "No Data";

    renderHistory(c);
}

// --- HISTORY LOGIC (WITH RED HIGHLIGHTS) ---
function renderHistory(c) {
    const hBody = document.getElementById('v-history-body');
    if(!c.history) { hBody.innerHTML = ''; return; }

    hBody.innerHTML = Object.values(c.history).map(h => {
        // Red highlight if time is past 18:00 (6:00 PM)
        const isLate = h.time > "18:00" ? 'late-payment' : '';
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

// --- RECORD PAYMENT (PROMPTS INCLUDED) ---
function recordPayment() {
    if(!confirm("Are you sure you want to post this payment?")) return;
    
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const details = document.getElementById('act-details').value;

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
