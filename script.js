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
let activeKey = null;

// --- REAL-TIME DATA SYNC ---
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainList(); // IMMEDIATE UPDATE
    runAnalytics();
});

// --- NAVIGATION ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function showSec(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}

// --- ENROLL CLIENT ---
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("ID and Principal are required!");

    const payload = {
        name: document.getElementById('e-name').value,
        idNo: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active',
        lastUpdated: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + id).set(payload).then(() => {
        alert("Client Enrolled!");
        document.querySelectorAll('#add-sec input').forEach(i => i.value = ''); // Clear form
        showSec('list-sec'); // Jump back to table immediately
    });
}

// --- RENDERING LIST ---
function renderMainList() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td>
            <td class="text-red">KSH ${(c.principal - (c.totalPaid || 0))}</td>
            <td><button class="btn btn-p" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

// --- DOSSIER VIEW ---
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    showSec('view-sec');

    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-last-up').innerText = c.lastUpdated;
    document.getElementById('v-phone').innerText = c.phone;
    document.getElementById('v-loc').innerText = c.location;
    document.getElementById('v-occ').innerText = c.occupation;
    document.getElementById('v-ref').innerText = c.referral;

    document.getElementById('v-princ').innerText = c.principal.toLocaleString();
    document.getElementById('v-paid').innerText = (c.totalPaid || 0).toLocaleString();
    document.getElementById('v-bal').innerText = (c.principal - (c.totalPaid || 0)).toLocaleString();
    document.getElementById('v-next').innerText = c.nextDue || "No data";

    renderHistory(c);
}

function renderHistory(c) {
    const histBody = document.getElementById('v-history-body');
    if(!c.history) { histBody.innerHTML = '<tr><td colspan="5">No history</td></tr>'; return; }
    
    histBody.innerHTML = Object.values(c.history).map(h => {
        // LATE RULE: HIGHLIGHT IF TIME > 18:00 (6 PM)
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

// --- ACTIONS ---
function recordPayment() {
    if(!confirm("Are you sure you want to post this payment?")) return;
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const details = document.getElementById('act-details').value;
    if(!amt || !time) return alert("Fill amount and time");

    const c = clients.find(x => x.key === activeKey);
    const newTotal = (c.totalPaid || 0) + amt;

    const entry = {
        date: new Date().toLocaleDateString(),
        activity: 'Payment',
        details: `KSH ${amt} | Next: ${details}`,
        time: time,
        handledBy: 'Admin'
    };

    db.ref(`jml_master_records/${activeKey}`).update({
        totalPaid: newTotal,
        lastUpdated: new Date().toLocaleString(),
        nextDue: details
    });
    db.ref(`jml_master_records/${activeKey}/history`).push(entry);
}

function runAnalytics() {
    let grandOut = 0;
    clients.forEach(c => grandOut += parseFloat(c.principal || 0));
    document.getElementById('f-total-out').innerText = "KSH " + grandOut.toLocaleString();
}
