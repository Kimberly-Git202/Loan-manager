// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    storageBucket: "jml-loans-560d8.appspot.com",
    messagingSenderId: "367252876657",
    appId: "1:367252876657:web:6e8f498c0a8767980e6082"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const app = {
    clients: [],
    activeKey: null,

    init() {
        db.collection('clients').orderBy('createdAt', 'desc').onSnapshot(snap => {
            this.clients = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderList();
            this.calcFinance();
        });
    },

    // 1.25x RULE APPLIED HERE
    async enrollClient() {
        const idNo = document.getElementById('en-id').value;
        const princ = parseFloat(document.getElementById('en-princ').value);
        if(!idNo || isNaN(princ)) return alert("Error: ID and Principal required.");

        const clientData = {
            name: document.getElementById('en-name').value,
            idNo: idNo,
            phone: document.getElementById('en-phone').value,
            location: document.getElementById('en-loc').value,
            occupation: document.getElementById('en-occ').value,
            referral: document.getElementById('en-ref').value,
            principal: princ,
            totalPaid: 0,
            balance: princ * 1.25, // THE PROFIT RULE
            status: 'Active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: new Date().toLocaleString(),
            history: [],
            notes: ""
        };

        await db.collection('clients').doc(idNo).set(clientData);
        alert("Success: Client Enrolled.");
        this.resetEnrollForm();
        ui.showModule('list-sec', document.querySelector('.nav-item'));
    },

    // EXECUTE OPERATIONS WITH CONFIRMATION
    async execute(type) {
        if(!confirm(`Are you sure you want to proceed with ${type}?`)) return;
        const amt = parseFloat(document.getElementById('o-amt').value);
        const time = document.getElementById('o-time').value;
        const client = this.clients.find(c => c.id === this.activeKey);

        if(type === 'pay') {
            const newBal = client.balance - amt;
            const newPaid = client.totalPaid + amt;
            const entry = {
                date: new Date().toLocaleDateString(),
                activity: 'Payment',
                details: document.getElementById('o-det').value,
                time: time,
                by: 'Admin'
            };
            await db.collection('clients').doc(this.activeKey).update({
                balance: newBal,
                totalPaid: newPaid,
                history: firebase.firestore.FieldValue.arrayUnion(entry),
                updatedAt: new Date().toLocaleString()
            });
        }
        
        if(type === 'new') {
            // Restart with 1.25 logic
            await db.collection('clients').doc(this.activeKey).update({
                principal: amt,
                balance: amt * 1.25,
                totalPaid: 0,
                history: firebase.firestore.FieldValue.arrayUnion({
                    date: new Date().toLocaleDateString(),
                    activity: 'New Loan',
                    details: 'Cycle Restarted',
                    time: time || '08:00',
                    by: 'Admin'
                })
            });
        }
    },

    renderList(data = this.clients) {
        const body = document.getElementById('mainTableBody');
        body.innerHTML = data.map((c, i) => `
            <tr>
                <td>${i+1}</td>
                <td><b>${c.name}</b></td>
                <td>${c.idNo}</td>
                <td>${c.phone}</td>
                <td class="text-green">KSH ${c.totalPaid}</td>
                <td class="text-red">KSH ${c.balance.toFixed(0)}</td>
                <td><button class="btn btn-primary btn-sm" onclick="app.openDossier('${c.id}')">VIEW</button></td>
            </tr>
        `).join('');
    },

    openDossier(id) {
        this.activeKey = id;
        const c = this.clients.find(x => x.id === id);
        ui.showModule('dossier-sec');
        
        document.getElementById('d-name').innerText = c.name;
        document.getElementById('d-id').innerText = c.idNo;
        document.getElementById('v-p').innerText = c.principal;
        document.getElementById('v-tp').innerText = c.totalPaid;
        document.getElementById('v-bal').innerText = c.balance.toFixed(0);
        document.getElementById('d-info-box').innerHTML = `
            <p><b>Phone:</b> ${c.phone}</p><p><b>Loc:</b> ${c.location}</p>
            <p><b>Occ:</b> ${c.occupation}</p><p><b>Ref:</b> ${c.referral}</p>
        `;

        const hBody = document.getElementById('d-hist-body');
        hBody.innerHTML = (c.history || []).reverse().map((h, index, arr) => {
            const isLate = h.time > "18:00" ? 'late-entry' : '';
            const isNew = h.activity === 'New Loan' ? 'new-loan-row' : '';
            
            // SKIPPED DAY DETECTION
            let isSkipped = '';
            if(index < arr.length - 1) {
                const d1 = new Date(h.date);
                const d2 = new Date(arr[index+1].date);
                if((d1 - d2) / (1000*3600*24) > 1) isSkipped = 'skipped-day';
            }

            return `<tr class="${isLate} ${isNew} ${isSkipped}">
                <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td>
                <td>${h.time}</td><td>${h.by}</td>
            </tr>`;
        }).join('');
    }
};

const ui = {
    showModule(id, el) {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if(el) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            el.classList.add('active');
        }
    },
    toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); },
    toggleTheme() { document.body.classList.toggle('dark-mode'); }
};

app.init();
