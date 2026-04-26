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

// SIDEBAR MINIMIZER & TAB SWITCHER
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if(window.innerWidth > 900) {
        sb.classList.toggle('minimized');
    } else {
        sb.classList.toggle('open');
    }
}

function switchTab(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
    if(window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
}

// ENROLL & AUTO-REDIRECT
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || !princ) return alert("Fill ID and Principal!");

    const data = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', officer: '', history: [], lastUp: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + id).set(data).then(() => {
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        switchTab('list-sec'); // Disappear form and see table immediately
    });
}

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
            <td><button class="btn btn-main btn-sm" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    switchTab('view-sec');
    
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = (c.principal - (c.totalPaid || 0));
    document.getElementById('v-last-up').innerText = c.lastUp;

    const histBody = document.getElementById('v-history-body');
    histBody.innerHTML = c.history ? Object.values(c.history).map(h => {
        const late = h.time > '18:00' ? 'late-flag' : '';
        const isNew = h.activity === 'New Loan' ? 'new-loan-flag' : '';
        return `<tr class="${late} ${isNew}"><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>Admin</td></tr>`;
    }).join('') : '';
}

function actionPrompt(type) {
    if(!confirm("Are you sure you want to proceed?")) return;
    // Logic for recordPayment, settleLoan etc follows here...
}
