// FIREBASE CONFIG
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
db.ref('jml_v2_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainTable();
});

// TAB SWITCHER
function switchTab(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}

function toggleSidebar() { 
    const sb = document.getElementById('sidebar');
    if(window.innerWidth > 900) sb.classList.toggle('minimized');
    else sb.classList.toggle('open');
}

// ENROLLMENT LOGIC (1.25x Rule)
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);

    if(!id || isNaN(princ)) {
        alert("Please enter ID and Principal Amount");
        return;
    }

    const data = {
        name: document.getElementById('e-name').value,
        phone: document.getElementById('e-phone').value,
        idNo: id,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        totalPaid: 0,
        // The 1.25x Multiplier for Balance
        balance: princ * 1.25,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active',
        lastUp: new Date().toLocaleString(),
        history: [],
        notes: ""
    };

    // Save to Firebase
    db.ref('jml_v2_records/' + id).set(data).then(() => {
        alert("Client Enrolled Successfully!");
        // Reset Form
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        // REDIRECT TO LIST - FIX FOR YOUR SKETCH
        switchTab('list-sec', document.querySelector('.nav-item:first-child'));
    }).catch(err => alert("Error: " + err.message));
}

// RENDER CLIENTS TABLE
function renderMainTable() {
    const tbody = document.getElementById('clientsBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td class="text-green">KSH ${c.totalPaid || 0}</td>
            <td class="text-red">KSH ${c.balance || 0}</td>
            <td><button class="btn btn-main btn-sm" onclick="openDossier('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

// DOSSIER VIEW
function openDossier(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    if(!c) return;

    switchTab('view-sec');
    document.getElementById('v-name-header').innerText = c.name;
    document.getElementById('v-id-header').innerText = c.idNo;
    document.getElementById('v-last-header').innerText = c.lastUp;
    document.getElementById('v-p').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = c.balance || 0;
    document.getElementById('v-notes').value = c.notes || "";

    const infoBody = document.getElementById('v-info-body');
    infoBody.innerHTML = `
        <p><strong>Phone:</strong> ${c.phone}</p>
        <p><strong>Location:</strong> ${c.location}</p>
        <p><strong>Job:</strong> ${c.occupation}</p>
        <p><strong>Ref:</strong> ${c.referral}</p>
    `;

    renderHistory(c.history);
}

function renderHistory(history) {
    const hBody = document.getElementById('v-history-body');
    if(!history) { hBody.innerHTML = ""; return; }
    
    hBody.innerHTML = Object.values(history).reverse().map(h => {
        // Late highlight rule (18:00)
        const isLate = h.time > "18:00" ? "late-row" : "";
        const isNew = h.activity === "New Loan" ? "new-loan-row" : "";
        return `<tr class="${isLate} ${isNew}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>Admin</td>
        </tr>`;
    }).join('');
}

// PAYMENT PROCESSING
function recordPayment() {
    const amt = parseFloat(document.getElementById('p-amt').value);
    const time = document.getElementById('p-time').value;
    if(!amt || !time) return alert("Amount and Time required!");

    if(!confirm("Confirm payment of KSH " + amt + "?")) return;

    const c = clients.find(x => x.key === activeKey);
    const newPaid = (c.totalPaid || 0) + amt;
    const newBal = (c.balance || 0) - amt;

    const log = {
        date: new Date().toLocaleDateString(),
        activity: "Payment",
        details: document.getElementById('p-next').value || "Manual Payment",
        time: time
    };

    db.ref(`jml_v2_records/${activeKey}`).update({
        totalPaid: newPaid,
        balance: newBal,
        lastUp: new Date().toLocaleString()
    });

    db.ref(`jml_v2_records/${activeKey}/history`).push(log);
    
    // Clear inputs
    document.getElementById('p-amt').value = '';
}
