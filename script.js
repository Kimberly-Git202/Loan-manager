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
db.ref('jml_records').on('value', snap => {
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

// ENROLL (The 1.25x Rule)
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Required fields missing!");

    // Balance starts at Principal * 1.25
    const initialBalance = princ * 1.25;

    const data = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        currentBalance: initialBalance,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', history: [], lastUp: new Date().toLocaleString()
    };

    db.ref('jml_records/' + id).set(data).then(() => {
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        switchTab('list-sec', document.querySelector('.nav-item:first-child'));
    });
}

// ACTION HANDLER (WITH PROMPTS)
function handleAction(type) {
    const c = clients.find(x => x.key === activeKey);
    if(!confirm("Are you sure you want to perform this action?")) return;

    if(type === 'pay') {
        const amt = parseFloat(document.getElementById('act-amt').value);
        const time = document.getElementById('act-time').value;
        if(!amt || !time) return alert("Enter amount and time");

        const newPaid = (c.totalPaid || 0) + amt;
        const newBal = c.currentBalance - amt;

        db.ref(`jml_records/${activeKey}`).update({
            totalPaid: newPaid,
            currentBalance: newBal,
            lastUp: new Date().toLocaleString()
        });

        db.ref(`jml_records/${activeKey}/history`).push({
            date: new Date().toLocaleDateString(),
            activity: 'Payment',
            details: document.getElementById('act-det').value,
            time: time,
            amt: amt
        });
    }
    // New Loan Logic (Multiplier reapplied)
    if(type === 'new') {
        const newPrinc = parseFloat(document.getElementById('act-amt').value);
        const newBal = newPrinc * 1.25;
        db.ref(`jml_records/${activeKey}`).update({
            principal: newPrinc,
            currentBalance: newBal,
            totalPaid: 0,
            lastUp: new Date().toLocaleString()
        });
        db.ref(`jml_records/${activeKey}/history`).push({
            date: new Date().toLocaleDateString(),
            activity: 'New Loan',
            details: 'Cycle Restarted',
            time: '08:00',
            amt: newPrinc
        });
    }
}

// RENDER DOSSIER
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    switchTab('view-sec');
    
    document.getElementById('v-name-top').innerText = c.name;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.currentBalance;
    document.getElementById('v-up-top').innerText = c.lastUp;

    const histBody = document.getElementById('v-history');
    if(c.history) {
        histBody.innerHTML = Object.values(c.history).map(h => {
            const isLate = h.time > "18:00" ? 'late-row' : '';
            const isNew = h.activity === 'New Loan' ? 'new-loan-row' : '';
            return `<tr class="${isLate} ${isNew}">
                <td>${h.date}</td>
                <td>${h.activity}</td>
                <td>${h.details}</td>
                <td>${h.time}</td>
                <td>Admin</td>
            </tr>`;
        }).reverse().join('');
    }
}

function renderMainList() {
    const body = document.getElementById('clientsBody');
    body.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid}</td>
            <td class="text-red">KSH ${c.currentBalance}</td>
            <td><button class="btn btn-main btn-sm" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}
