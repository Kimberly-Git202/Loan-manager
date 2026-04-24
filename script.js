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

// SYNC DATA & REFRESH UI IMMEDIATELY
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

// 1. ENROLL LOGIC (Auto-switches to table after success)
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("ID and Principal are required!");

    const data = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', 
        history: [],
        lastUpdated: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + id).set(data).then(() => {
        // Clear Form
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        // Jump to main list immediately
        switchTab('list-sec', document.querySelector('.nav-item:first-child'));
    });
}

// 2. MAIN LIST RENDER
function renderMainList() {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = clients.map((c, i) => {
        const balance = (c.principal || 0) - (c.totalPaid || 0);
        return `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td>
            <td class="text-red">KSH ${balance}</td>
            <td><button class="btn btn-p btn-sm" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>`;
    }).join('');
}

// 3. OPEN VIEW (DOSSIER)
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    switchTab('view-sec');
    
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-info-occ').innerText = c.occupation;
    document.getElementById('v-info-ref').innerText = c.referral;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = (c.principal - (c.totalPaid || 0));
    document.getElementById('v-last-up').innerText = c.lastUpdated;
    
    renderHistory(c);
}

// 4. HISTORY LOGIC (Red highlight for > 6PM and Row highight for New Loan)
function renderHistory(c) {
    const body = document.getElementById('v-history-body');
    if(!c.history) { body.innerHTML = ''; return; }
    
    body.innerHTML = Object.values(c.history).map(h => {
        const isLate = h.time > "18:00" ? 'late-payment' : '';
        const isNew = h.activity === 'New Loan' ? 'new-loan-row' : '';
        return `
            <tr class="${isLate} ${isNew}">
                <td>${h.date}</td>
                <td>${h.activity}</td>
                <td>${h.details}</td>
                <td>${h.time}</td>
                <td>${h.by || 'Admin'}</td>
            </tr>`;
    }).join('');
}

// 5. CONFIRMATION WRAPPER
function confirmAction(actionType) {
    if(!confirm("Are you sure you want to proceed?")) return;
    
    if(actionType === 'recordPayment') {
        const amt = parseFloat(document.getElementById('act-amt').value);
        const time = document.getElementById('act-time').value;
        const details = document.getElementById('act-details').value;
        if(!amt || !time) return alert("Fill amount and time");
        
        const c = clients.find(x => x.key === activeKey);
        const newTotal = (c.totalPaid || 0) + amt;
        
        db.ref(`jml_master_records/${activeKey}`).update({
            totalPaid: newTotal,
            lastUpdated: new Date().toLocaleString()
        });
        
        db.ref(`jml_master_records/${activeKey}/history`).push({
            date: new Date().toLocaleDateString(),
            activity: 'Payment',
            amt: amt,
            time: time,
            details: details,
            by: 'Admin'
        });
    }
    // Logic for other buttons follows same pattern...
}
