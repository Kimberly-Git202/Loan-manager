import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app"
};

const appInstance = initializeApp(firebaseConfig);
const db = getDatabase(appInstance);
const auth = getAuth(appInstance);

let clients = [];
let activeId = null;

// --- AUTH & DATA FLOW ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        clients = snap.val() ? Object.values(snap.val()) : [];
        app.renderTable();
        app.updateFinancials();
        if(activeId) app.openDashboard(activeId);
    });
}

// --- APP LOGIC ---
const app = {
    renderTable(data = clients) {
        const tbody = document.getElementById('clientTableBody');
        tbody.innerHTML = data.map((c, i) => `
            <tr>
                <td>${i+1}</td>
                <td><b>${c.name}</b></td>
                <td>${c.idNo}</td>
                <td>${c.phone}</td>
                <td class="text-success">KSh ${((c.loan * 1.25) - c.balance).toLocaleString()}</td>
                <td class="text-danger">KSh ${c.balance.toLocaleString()}</td>
                <td><button class="btn-sm btn-primary" onclick="app.openDashboard('${c.idNo}')">VIEW</button></td>
            </tr>`).join('');
    },

    openDashboard(id) {
        activeId = id;
        const c = clients.find(x => x.idNo === id);
        if(!c) return;
        
        document.getElementById('d-name').innerText = c.name;
        document.getElementById('d-id').innerText = c.idNo;
        document.getElementById('v-p').innerText = c.loan.toLocaleString();
        document.getElementById('v-tp').innerText = ((c.loan * 1.25) - c.balance).toLocaleString();
        document.getElementById('v-bal').innerText = c.balance.toLocaleString();
        document.getElementById('d-info-list').innerHTML = `
            <p><b>Phone:</b> ${c.phone}</p><p><b>Loc:</b> ${c.location}</p>
            <p><b>Occ:</b> ${c.occupation}</p><p><b>Ref:</b> ${c.referral}</p>`;
        
        // --- SMART HISTORY RENDERING ---
        const hBody = document.getElementById('historyBody');
        hBody.innerHTML = (c.history || []).reverse().map((h, index, arr) => {
            const isLate = h.time > "18:00" ? 'class="late-entry"' : '';
            const isNew = h.act === "Initial" ? 'class="new-loan-row"' : '';
            
            // Missed Day Detection logic
            let missedDay = '';
            if(index < arr.length - 1){
                const diff = (new Date(h.date) - new Date(arr[index+1].date)) / (1000*3600*24);
                if(diff > 1) missedDay = 'class="skipped-day"';
            }

            return `<tr ${isLate || isNew || missedDay}>
                <td>${h.date}</td><td>${h.act}</td><td>${h.det}</td>
                <td>${h.time}</td><td>${h.by}</td>
            </tr>`;
        }).join('');

        document.getElementById('detailWindow').classList.remove('hidden');
    },

    processAction(type) {
        if(!confirm(`Confirm ${type}?`)) return;
        const amt = parseFloat(document.getElementById('payAmt').value);
        const time = document.getElementById('payTime').value;
        const det = document.getElementById('payDet').value;
        const c = clients.find(x => x.idNo === activeId);
        const staff = auth.currentUser.email.split('@')[0];

        if(type === 'pay') {
            const newBal = c.balance - amt;
            update(ref(db, `jml_data/${activeId}`), {
                balance: newBal,
                history: [...(c.history || []), { 
                    date: new Date().toLocaleDateString('en-GB'),
                    time: time, act: "Payment", det: det, by: staff
                }]
            });
        }
        
        if(type === 'settle') {
            update(ref(db, `jml_data/${activeId}`), {
                balance: 0, loan: 0,
                history: [...(c.history || []), { 
                    date: new Date().toLocaleDateString('en-GB'),
                    time: time || "12:00", act: "Settled", det: "Loan Cleared", by: staff
                }]
            });
        }
    },

    updateFinancials() {
        let out = 0, today = 0, profit = 0;
        const dateStr = new Date().toLocaleDateString('en-GB');
        clients.forEach(c => {
            out += c.balance;
            (c.history || []).forEach(h => {
                if(h.date === dateStr && h.act === "Payment") today += h.amt;
            });
            // Profit is the 0.25 part of any payment
            profit += ((c.loan * 1.25) - c.balance) * 0.2;
        });
        document.getElementById('total-out').innerText = `KSh ${out.toLocaleString()}`;
        document.getElementById('total-today').innerText = `KSh ${today.toLocaleString()}`;
        document.getElementById('total-profit').innerText = `KSh ${profit.toLocaleString()}`;
    },

    searchClients() {
        const val = document.getElementById('globalSearch').value.toLowerCase();
        const filtered = clients.filter(c => c.name.toLowerCase().includes(val) || c.idNo.includes(val));
        this.renderTable(filtered);
    }
};

// --- GLOBALS ---
window.app = app;
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(() => alert("Invalid Credentials"));
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');
window.toggleDarkMode = () => document.body.classList.toggle('dark-mode');
window.closeDetails = () => { activeId = null; document.getElementById('detailWindow').classList.add('hidden'); };

window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = parseFloat(document.getElementById('f-loan').value);
    const id = document.getElementById('f-id').value;
    set(ref(db, `jml_data/${id}`), {
        name: document.getElementById('f-name').value,
        idNo: id, phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        occupation: document.getElementById('f-occ').value,
        referral: document.getElementById('f-ref').value,
        loan: p, balance: p * 1.25, // THE 1.25 RULE
        history: [{ date: new Date().toLocaleDateString('en-GB'), time: "08:00", act: "Initial", det: "Account Opened", by: "System" }]
    });
    e.target.reset();
    showSection('list-sec', document.querySelector('.nav-item'));
});
