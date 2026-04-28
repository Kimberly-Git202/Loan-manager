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

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'clients/'), (snap) => {
        const val = snap.val();
        clients = val ? Object.values(val) : [];
        app.render();
        app.updateFinancials();
        if(activeId) app.openDossier(activeId);
    });
}

const app = {
    render(data = clients) {
        const tbody = document.getElementById('clientTableBody');
        tbody.innerHTML = data.map((c, i) => `
            <tr onclick="app.openDossier('${c.id}')">
                <td>${i+1}</td>
                <td><b>${c.name}</b></td>
                <td>${c.id}</td>
                <td>${c.phone}</td>
                <td class="text-success">KSh ${((c.principal * 1.25) - c.balance).toLocaleString()}</td>
                <td class="text-danger">KSh ${c.balance.toLocaleString()}</td>
                <td><button class="btn-view">VIEW</button></td>
            </tr>`).join('');
    },

    openDossier(id) {
        activeId = id;
        const c = clients.find(x => x.id === id);
        if(!c) return;

        document.getElementById('d-name').innerText = c.name;
        document.getElementById('d-id').innerText = c.id;
        document.getElementById('d-up').innerText = c.updatedAt || 'New';
        document.getElementById('v-p').innerText = c.principal.toLocaleString();
        document.getElementById('v-tp').innerText = ((c.principal * 1.25) - c.balance).toLocaleString();
        document.getElementById('v-bal').innerText = c.balance.toLocaleString();
        document.getElementById('info-content').innerHTML = `
            <p><b>Phone:</b> ${c.phone}</p><p><b>Loc:</b> ${c.location}</p>
            <p><b>Occ:</b> ${c.occupation}</p><p><b>Ref:</b> ${c.referral}</p>`;
        
        // --- Smart History Logic ---
        const hBody = document.getElementById('historyBody');
        hBody.innerHTML = (c.history || []).reverse().map((h, idx, arr) => {
            const isLate = h.time > "18:00" ? 'class="row-late"' : '';
            const isNew = h.act === "New Loan Issued" ? 'class="row-new"' : '';
            
            // Missed Day Calculation
            let missedDay = '';
            if(idx < arr.length - 1) {
                const diff = (new Date(h.date) - new Date(arr[idx+1].date)) / (1000*3600*24);
                if(diff > 1) missedDay = 'class="row-missed"';
            }

            return `<tr ${isLate || isNew || missedDay}>
                <td>${h.date}</td><td>${h.act}</td>
                <td>${h.time || '--:--'}</td><td>${h.by}</td>
            </tr>`;
        }).join('');

        document.getElementById('dossierWindow').classList.remove('hidden');
    },

    processAction(type) {
        const amt = parseFloat(document.getElementById('payAmt').value);
        const time = document.getElementById('payTime').value;
        const c = clients.find(x => x.id === activeId);
        const user = auth.currentUser.email.split('@')[0];

        if(type === 'pay') {
            if(!amt || !time || !confirm(`Record KSh ${amt}?`)) return;
            update(ref(db, `clients/${activeId}`), {
                balance: c.balance - amt,
                updatedAt: new Date().toLocaleString(),
                history: [...(c.history || []), {
                    date: new Date().toLocaleDateString('en-GB'),
                    time: time, act: `Payment: KSh ${amt}`, by: user
                }]
            });
        }
        
        if(type === 'settle') {
            if(!confirm("Settle this loan? It will be archived.")) return;
            update(ref(db, `clients/${activeId}`), {
                balance: 0, 
                history: [...(c.history || []), { 
                    date: new Date().toLocaleDateString('en-GB'), 
                    time: "12:00", act: "Loan Settled", by: user 
                }]
            });
        }
    },

    updateFinancials() {
        let out = 0, today = 0, profit = 0;
        const todayStr = new Date().toLocaleDateString('en-GB');
        clients.forEach(c => {
            out += c.balance;
            (c.history || []).forEach(h => {
                if(h.date === todayStr && h.act.includes("Payment")) {
                    const val = parseFloat(h.act.split('KSh ')[1]);
                    today += val;
                }
            });
            // 1.25x Profit Rule calculation
            const paidAmt = (c.principal * 1.25) - c.balance;
            profit += (paidAmt * 0.2); // Since 0.25 on top of 1.0 is 20% of the total 1.25
        });
        document.getElementById('fin-out').innerText = `KSh ${out.toLocaleString()}`;
        document.getElementById('fin-today').innerText = `KSh ${today.toLocaleString()}`;
        document.getElementById('fin-profit').innerText = `KSh ${profit.toLocaleString()}`;
    }
};

window.app = app;
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(() => alert("Error"));
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');
window.toggleDarkMode = () => document.body.classList.toggle('dark-mode');

window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};

document.getElementById('enrollForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = parseFloat(document.getElementById('f-loan').value);
    const id = document.getElementById('f-id').value;
    set(ref(db, `clients/${id}`), {
        name: document.getElementById('f-name').value,
        id: id, phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        occupation: document.getElementById('f-occ').value,
        referral: document.getElementById('f-ref').value,
        principal: p,
        balance: p * 1.25, // THE 1.25X AUTOMATION RULE
        history: [{ 
            date: new Date().toLocaleDateString('en-GB'), 
            time: "08:00", act: "New Loan Issued", by: "System" 
        }]
    });
    e.target.reset();
    showSection('list-sec', document.querySelector('.nav-item'));
});
