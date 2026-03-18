// ==========================================
// 1. INITIALIZATION & SERVICE WORKER
// ==========================================
const LAB_PHOTOS_STORE = "labPhotos";

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('d-none');
    });
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.remove('d-none');
        window.scrollTo(0, 0);
    } else {
        console.error("Could not find tab with ID:", tabId);
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Offline Mode Ready!', reg))
            .catch(err => console.log('Offline Setup Failed', err));
    });
}

window.onload = () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const themeSwitch = document.getElementById('themeSwitch');
        if (themeSwitch) themeSwitch.checked = true;
    }
    
    showTab('chemTab');
    displayConstants();
    updateCardUI();
};

// ==========================================
// 2. GLOBAL DATA & DATABASE SETUP
// ==========================================
const CHEM_CONSTANTS = [
    { name: "Gas Constant (R)", value: "8.314", unit: "J/(mol·K)", label: "SI Units" },
    { name: "Gas Constant (R)", value: "0.08206", unit: "L·atm/(mol·K)", label: "Atmospheres" },
    { name: "Gas Constant (R)", value: "62.364", unit: "L·torr/(mol·K)", label: "Torr/mmHg" },
    { name: "Avogadro's (Nₐ)", value: "6.022e23", unit: "mol⁻¹", label: "Entities" },
    { name: "Boltzmann (kᵦ)", value: "1.381e-23", unit: "J/K", label: "Energy/Temp" },
    { name: "STP Temp", value: "273.15", unit: "K", label: "Standard Temp" },
    { name: "STP Pressure", value: "1.000", unit: "atm", label: "Standard Press" }
];

const ATOMIC_WEIGHTS = {
    H: 1.008, He: 4.003, B: 10.81, C: 12.01, N: 14.01, O: 16.00, F: 19.00, Ne: 20.18,
    P: 30.97, S: 32.06, Cl: 35.45, Ar: 39.95, Se: 78.97, Br: 79.90, Kr: 83.80, I: 126.90,
    Li: 6.94, Na: 22.99, K: 39.10, Rb: 85.47, Cs: 132.91,
    Be: 9.01, Mg: 24.31, Ca: 40.08, Sr: 87.62, Ba: 137.33,
    Ti: 47.87, V: 50.94, Cr: 52.00, Mn: 54.94, Fe: 55.85, Co: 58.93, Ni: 58.69, 
    Cu: 63.55, Zn: 65.38, Mo: 95.95, Pd: 106.42, Ag: 107.87, Cd: 112.41, 
    Pt: 195.08, Au: 196.97, Hg: 200.59, Pb: 207.2, W: 183.84,
    Al: 26.98, Si: 28.09, Sn: 118.71, Sb: 121.76
};

let db;
const dbRequest = indexedDB.open("StudyBuddyDB", 1);
dbRequest.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(LAB_PHOTOS_STORE)) {
        db.createObjectStore(LAB_PHOTOS_STORE, { keyPath: "noteId" });
    }
};
dbRequest.onsuccess = (e) => {
    db = e.target.result;
    displayNotes(); 
};
dbRequest.onerror = (e) => {
    console.error("Database error:", e.target.error);
};

// ==========================================
// 3. CORE NAVIGATION & UI
// ==========================================
function toggleTheme() {
    const themeSwitch = document.getElementById('themeSwitch');
    const isDark = themeSwitch ? themeSwitch.checked : false;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function showToast(message) {
    let toast = document.getElementById('toastMsg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastMsg';
        toast.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:10px 20px;border-radius:20px;z-index:10000;transition:opacity 0.3s;font-size:14px;";
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    setTimeout(() => toast.style.opacity = '0', 2500);
}

function displayConstants() {
    const table = document.getElementById('constantsTable');
    if (!table) return;
    table.innerHTML = CHEM_CONSTANTS.map(c => `
        <tr class="border-bottom">
            <td>
                <div class="fw-bold text-primary">${c.name}</div>
                <div class="text-muted" style="font-size: 0.7rem;">${c.label}</div>
            </td>
            <td class="text-end">
                <code class="fw-bold text-dark">${c.value}</code><br>
                <small class="text-secondary">${c.unit}</small>
            </td>
            <td class="text-end">
                <button class="btn btn-sm p-0 text-info" onclick="copyToNote('${c.value}')">📋</button>
            </td>
        </tr>
    `).join('');
}

function copyToNote(value) {
    const noteArea = document.getElementById('noteContent');
    if (noteArea) {
        noteArea.value += (noteArea.value ? ' ' : '') + value;
        showToast("Constant added to note!");
    } else {
        showTab('notesTab');
        showToast("Switch to Logs to use this!");
    }
}

// ==========================================
// 4. NOTES & LOGS ENGINE
// ==========================================
async function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const photoInput = document.getElementById('labPhotoInput');
    const photoFile = photoInput ? photoInput.files[0] : null;

    if (!title || !content) {
        showToast("Please enter a title and content!");
        return;
    }

    const noteId = Date.now();
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    notes.unshift({ id: noteId, title, content, date: new Date().toLocaleString() });
    localStorage.setItem('studyNotes', JSON.stringify(notes));

    if (photoFile && db) {
        const transaction = db.transaction([LAB_PHOTOS_STORE], "readwrite");
        const storeRequest = transaction.objectStore(LAB_PHOTOS_STORE).add({ noteId: noteId, image: photoFile });
        storeRequest.onerror = (e) => console.error("Error adding photo:", e);
    }

    document.getElementById('noteTitle').value = "";
    document.getElementById('noteContent').value = "";
    if (photoInput) photoInput.value = "";
    displayNotes();
    showToast("Session Saved!");
}

function displayNotes() {
    const list = document.getElementById('notesList');
    if (!list) return;
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    if (notes.length === 0) {
        list.innerHTML = `<p class="text-center text-muted p-4">No logs yet.</p>`;
        return;
    }
    list.innerHTML = notes.map(n => `
    <div class="card p-3 mb-2 shadow-sm border-0 position-relative">
        <button class="btn btn-sm text-danger position-absolute top-0 end-0 m-1" 
                onclick="deleteNote(${n.id})" style="z-index: 5;">
            <i class="fas fa-trash"></i>
        </button>
        
        <h6 class="fw-bold text-primary mb-1 pe-4">${n.title}</h6>
        <p class="small text-secondary mb-2">${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}</p>
        
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-info flex-grow-1" onclick="viewPhoto(${n.id})">🖼️ View Photo</button>
        </div>
    </div>
    `).join('');
}

function deleteNote(noteId) {
    if (!confirm("Delete this log?")) return;
    let notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem('studyNotes', JSON.stringify(notes));
    if (db) {
        const transaction = db.transaction([LAB_PHOTOS_STORE], "readwrite");
        transaction.objectStore(LAB_PHOTOS_STORE).delete(noteId).onerror = (e) => console.error("Error deleting note:", e);
    }
    displayNotes();
}

function viewPhoto(noteId) {
    if (!db) return;
    const transaction = db.transaction([LAB_PHOTOS_STORE], "readonly");
    const request = transaction.objectStore(LAB_PHOTOS_STORE).get(noteId);
    request.onsuccess = () => {
        if (request.result) {
            const url = URL.createObjectURL(request.result.image);
            window.open(url, '_blank');
            // Safely revoke memory after a delay to ensure the new tab loads the image first
            setTimeout(() => URL.revokeObjectURL(url), 5000); 
        } else { 
            showToast("No photo found."); 
        }
    };
    request.onerror = (e) => console.error("Error fetching photo:", e);
}

function toggleFullScreenNote(event) {
    const noteArea = document.getElementById('noteContent');
    const ev = event || window.event;
    const btn = ev.currentTarget || ev.srcElement;
    
    if (!noteArea.classList.contains('full-screen-note')) {
        noteArea.classList.add('full-screen-note');
        btn.innerHTML = '<i class="fas fa-compress"></i> Exit & Save';
        btn.classList.replace('btn-light', 'btn-danger');
        btn.style.position = 'fixed';
        btn.style.top = '10px';
        btn.style.right = '10px';
        btn.style.zIndex = '10000'; 
    } else {
        noteArea.classList.remove('full-screen-note');
        btn.innerHTML = '<i class="fas fa-expand"></i> Full Screen';
        btn.classList.replace('btn-danger', 'btn-light');
        btn.style.position = 'absolute';
        btn.style.top = '0';
        btn.style.right = '0';
    }
}

// ==========================================
// 5. CHEMISTRY TOOLS & CALCULATORS
// ==========================================
function calculateMolarMass() {
    const formulaInput = document.getElementById('chemFormula');
    const resultDisplay = document.getElementById('chemResult');
    const solMMInput = document.getElementById('solMM');
    if(!formulaInput || !resultDisplay) return;
    
    let formula = formulaInput.value.trim();
    if (!formula) {
        showToast("Enter a formula first!");
        return;
    }

    let totalMass = 0;
    const bracketRegex = /\(([^)]+)\)(\d*)/g;
    let bracketMatch;
    
    while ((bracketMatch = bracketRegex.exec(formula)) !== null) {
        const innerFormula = bracketMatch[1];
        const multiplier = parseInt(bracketMatch[2]) || 1;
        const innerMass = calculateSimpleMass(innerFormula);
        if (innerMass === null) {
            resultDisplay.innerHTML = `<span class="text-danger small">Error in brackets</span>`;
            return;
        }
        totalMass += (innerMass * multiplier);
    }

    const remainingFormula = formula.replace(/\(([^)]+)\)(\d*)/g, '');
    const restMass = calculateSimpleMass(remainingFormula);
    
    if (restMass === null) {
        resultDisplay.innerHTML = `<span class="text-danger small">Invalid Element</span>`;
        return;
    }
    
    totalMass += restMass;
    const formattedMass = totalMass.toFixed(3);
    resultDisplay.innerHTML = `<span class="fw-bold text-info">${formattedMass} g/mol</span>`;
    if (solMMInput) solMMInput.value = formattedMass;
}

function calculateSimpleMass(subFormula) {
    if (!subFormula) return 0;
    const elementRegex = /([A-Z][a-z]*)(\d*)/g;
    let mass = 0;
    let match;
    let found = false;
    while ((match = elementRegex.exec(subFormula)) !== null) {
        found = true;
        const element = match[1];
        const count = parseInt(match[2]) || 1;
        if (ATOMIC_WEIGHTS[element]) {
            mass += ATOMIC_WEIGHTS[element] * count;
        } else {
            return null;
        }
    }
    return found ? mass : 0;
}

function calculateMolarity() {
    const mass = parseFloat(document.getElementById('solMass').value);
    const mm = parseFloat(document.getElementById('solMM').value);
    const vol = parseFloat(document.getElementById('solVol').value);
    const resDiv = document.getElementById('solResult');

    if (isNaN(mass) || isNaN(mm) || isNaN(vol)) {
        showToast("Fill Mass, Molar Mass, and Volume!");
        return;
    }
    const molarity = (mass / mm) / (vol / 1000);
    resDiv.innerHTML = `Molarity: <span class="text-dark">${molarity.toFixed(4)} M</span>`;
}

function calculateDilution() {
    const m1 = parseFloat(document.getElementById('dilM1').value);
    const v1 = parseFloat(document.getElementById('dilV1').value);
    const m2 = parseFloat(document.getElementById('dilM2').value);
    const v2 = parseFloat(document.getElementById('dilV2').value);
    const resDiv = document.getElementById('solResult');

    let resText = "";
    if (isNaN(m1)) resText = `M1 = ${(m2 * v2) / v1} M`;
    else if (isNaN(v1)) resText = `V1 = ${(m2 * v2) / m1} mL`;
    else if (isNaN(m2)) resText = `M2 = ${(m1 * v1) / v2} M`;
    else if (isNaN(v2)) resText = `V2 = ${(m1 * v1) / m2} mL`;
    else {
        showToast("Leave one field empty!");
        return;
    }
    resDiv.innerHTML = `Result: <span class="text-dark">${resText}</span>`;
}

function calculateGasLaw() {
    const P = parseFloat(document.getElementById('gasP').value);
    const V = parseFloat(document.getElementById('gasV').value);
    const n = parseFloat(document.getElementById('gasN').value);
    const T = parseFloat(document.getElementById('gasT').value);
    const pUnit = document.getElementById('gasPUnit').value;
    const resDiv = document.getElementById('gasResult');

    const R_VALUES = { atm: 0.08206, kPa: 8.314, bar: 0.08314 };
    const R = R_VALUES[pUnit];

    let resultText = "";
    if (isNaN(P)) resultText = `P = ${((n * R * T) / V).toFixed(3)} ${pUnit}`;
    else if (isNaN(V)) resultText = `V = ${((n * R * T) / P).toFixed(3)} L`;
    else if (isNaN(n)) resultText = `n = ${((P * V) / (R * T)).toFixed(3)} mol`;
    else if (isNaN(T)) resultText = `T = ${((P * V) / (n * R)).toFixed(2)} K`;
    else {
        showToast("Leave one field empty!");
        return;
    }
    resDiv.innerHTML = `Result: <span class="text-dark">${resultText}</span>`;
}

function convertUnits() {
    const val = parseFloat(document.getElementById('unitValue').value);
    const from = document.getElementById('unitFrom').value;
    const to = document.getElementById('unitTo').value;
    const display = document.getElementById('unitResult');

    if (isNaN(val)) return;

    if ((from === 'C' || from === 'K') && (to === 'C' || to === 'K')) {
        let res = (from === 'C' && to === 'K') ? val + 273.15 : (from === 'K' && to === 'C' ? val - 273.15 : val);
        display.innerHTML = `<b>${res.toFixed(2)} ${to}</b>`;
        return;
    }

    const energyFactors = { J: 1, kJ: 1000, cal: 4.184, kcal: 4184 };
    const pressureFactors = { atm: 1, psi: 0.068046, bar: 0.986923, kPa: 0.009869, torr: 0.00131579 };
    const volumeFactors = { L: 1, mL: 0.001, m3: 1000 };

    let factors = null;
    if (energyFactors[from] && energyFactors[to]) factors = energyFactors;
    else if (pressureFactors[from] && pressureFactors[to]) factors = pressureFactors;
    else if (volumeFactors[from] && volumeFactors[to]) factors = volumeFactors;

    if (!factors) {
        display.innerHTML = `<span class="text-danger small">Category Mismatch</span>`;
        return;
    }

    const result = (val * factors[from]) / factors[to];
    display.innerHTML = `<b>${result.toPrecision(5)} ${to}</b>`;
}

// ==========================================
// 6. AI, VOICE & OCR
// ==========================================
async function scanImage() {
    const status = document.getElementById('scanStatus');
    const cameraInput = document.getElementById('cameraInput');
    const file = cameraInput.files[0];
    if (!file) return;

    status.innerHTML = `<span class="spinner-border spinner-border-sm text-primary"></span> Processing...`;
    
    try {
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if(m.status === 'recognizing text') status.innerText = `Reading: ${Math.round(m.progress * 100)}%`;
            }
        });
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.AUTO });
        const { data: { text } } = await worker.recognize(file);
        
        if (text.trim().length > 0) {
            const noteArea = document.getElementById('noteContent');
            noteArea.value += (noteArea.value ? '\n\n' : '') + "[Scanned Data]:\n" + text.trim();
            status.innerHTML = "✅ Scan Successful";
            noteArea.dispatchEvent(new Event('input')); 
        } else {
            status.innerHTML = "⚠️ No text found. Try closer/brighter.";
        }
        await worker.terminate();
    } catch (e) {
        console.error("OCR Error:", e);
        status.innerHTML = "❌ Scan Failed.";
    } finally {
        cameraInput.value = ""; 
    }
}

let recognition = null; 
function toggleDictation() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return alert("Speech recognition is not supported in this browser.");

    if (recognition) {
        recognition.stop();
        return;
    }

    recognition = new Speech();
    recognition.lang = 'en-US';
    recognition.continuous = false; 
    recognition.interimResults = false;

    recognition.onstart = () => showToast("🎤 Listening for notes...");
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const noteArea = document.getElementById('noteContent');
        noteArea.value += (noteArea.value ? ' ' : '') + transcript;
        showToast("✅ Added!");
    };
    recognition.onerror = (event) => showToast("❌ Mic Error: " + event.error);
    recognition.onend = () => recognition = null;
    recognition.start();
}

function generateAIQuiz() {
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    if (notes.length === 0) return showToast("Save lab notes first!");
    
    const container = document.getElementById('quizContainer');
    const content = document.getElementById('quizContent');
    const latest = notes[0];
    const text = latest.content.toLowerCase();

    const knowledgeBase = {
        thermodynamics: {
            keywords: ["enthalpy", "entropy", "gibbs", "exothermic", "endothermic", "adiabatic", "hess"],
            templates: ["How does the change in {subject} drive the spontaneity of this reaction?", "Explain the energy transfer associated with the {subject} observed."]
        },
        organic: {
            keywords: ["alkane", "alkene", "benzene", "alcohol", "ester", "polymer", "nucleophile", "substitution"],
            templates: ["Identify the role of the {subject} functional group or mechanism in this reaction.", "How does the molecular structure of the {subject} affect its chemical properties?"]
        },
        blockElements: {
            keywords: ["alkali", "transition metal", "lanthanide", "electronegativity", "oxidation state", "ligand"],
            templates: ["Based on periodic trends, why does the {subject} exhibit these specific properties?", "Explain the role of the {subject} in complex formation."]
        },
        colloidal: {
            keywords: ["colloid", "emulsion", "micelle", "adsorption", "surfactant", "tyndall"],
            templates: ["What factors stabilize the {subject} mentioned?", "How would changing temperature or pressure affect the {subject}?"]
        },
        kinetics: {
            keywords: ["rate", "catalyst", "activation energy", "half-life", "equilibrium", "arrhenius"],
            templates: ["How did the {subject} influence the overall speed of the chemical reaction?", "Describe the rate-determining step involving the {subject}."]
        },
        separation: {
            keywords: ["distillation", "fractional", "chromatography", "extraction", "filtration", "crystallization"],
            templates: ["Why was {subject} the most appropriate technique for this specific mixture?", "What physical property does {subject} primarily exploit?"]
        }
    };

    let allMatches = [];
    for (const [category, data] of Object.entries(knowledgeBase)) {
        const matches = data.keywords.filter(word => text.includes(word));
        matches.forEach(match => allMatches.push({ category: category, keyword: match, templates: data.templates }));
    }

    allMatches = allMatches.sort(() => 0.5 - Math.random());
    let generatedQuestions = [];
    let selectedKeywords = new Set(); 

    for (let i = 0; i < allMatches.length; i++) {
        let match = allMatches[i];
        if (!selectedKeywords.has(match.keyword)) {
            selectedKeywords.add(match.keyword);
            let rawQ = match.templates[Math.floor(Math.random() * match.templates.length)];
            generatedQuestions.push(rawQ.replace("{subject}", `<span class="text-primary fw-bold">${match.keyword}</span>`));
        }
        if (generatedQuestions.length >= 3) break;
    }

    if (generatedQuestions.length === 0) {
        generatedQuestions.push(`What are the key sources of error for "<b>${latest.title}</b>"?`);
        generatedQuestions.push(`What is the industrial application of this procedure?`);
    }

    if(container) container.classList.remove('d-none');
    
    let quizHTML = `
        <div class="p-3 bg-light border-start border-primary border-4 mb-3 shadow-sm">
            <p class="small text-muted mb-3"><i class="fas fa-brain"></i> Analysis of: <b>${latest.title}</b></p>
    `;

    generatedQuestions.forEach((q, index) => {
        quizHTML += `
            <div class="mb-3">
                <p class="mb-1 fw-bold" style="font-size: 1.05rem;">Q${index + 1}: ${q}</p>
                <textarea id="quizAnswer_${index}" class="form-control border-secondary" style="height: 80px; resize: none;" placeholder="Type your answer..."></textarea>
            </div>
        `;
    });

    quizHTML += `
        </div>
        <button class="btn btn-primary w-100 fw-bold shadow-sm" onclick="checkMultipleQuiz(${generatedQuestions.length})">
            Submit Analysis
        </button>
    `;

    if(content) content.innerHTML = quizHTML;
}

function checkMultipleQuiz(questionCount) {
    let allValid = true;
    for (let i = 0; i < questionCount; i++) {
        let answerBox = document.getElementById(`quizAnswer_${i}`);
        if (answerBox && answerBox.value.trim().length < 10) {
            allValid = false;
            answerBox.classList.add('border-danger');
        } else if (answerBox) {
            answerBox.classList.remove('border-danger');
            answerBox.classList.add('border-success');
        }
    }

    if (!allValid) return showToast("Provide detailed explanations for all questions!");
    
    showToast("Excellent analysis! 100% Score.");
    setTimeout(() => {
        document.getElementById('quizContainer').classList.add('d-none');
    }, 1500);
}

// ==========================================
// 7. THREE-DECK FLASHCARD SYSTEM
// ==========================================
let currentCategory = 'thermodynamics';
let currentCardIndex = 0;
let isShowingAnswer = false;

let flashcardData = { 
    // ... all your new thermo, organic, general cards here ...

    thermodynamics: [
        { q: "What is Enthalpy (H)?", a: "The total heat content of a system at constant pressure." },
        { q: "What is the 1st Law of Thermodynamics?", a: "Energy cannot be created or destroyed, only transformed." }
    ],
    organic: [
        { q: "What is Markovnikov's Rule?", a: "In addition reactions, the H attaches to the carbon with more hydrogens." },
        { q: "What is a Nucleophile?", a: "An electron-rich species that donates an electron pair to an electrophile." }
    ],
    general: [
        { q: "What is Le Chatelier's Principle?", a: "If a constraint is applied to a system in equilibrium, the system will shift to counteract the constraint." },
        { q: "Avogadro's Law", a: "Equal volumes of gases at the same T and P contain equal numbers of molecules." }
    ]
};

function switchDeck(category) {
    currentCategory = category;
    currentCardIndex = 0;
    isShowingAnswer = false;
    
    const deckNameEl = document.getElementById('target-deck-name');
    if (deckNameEl) {
        deckNameEl.innerText = category.charAt(0).toUpperCase() + category.slice(1);
    }
    
    updateCardUI();
}

function updateCardUI() {
    const deck = flashcardData[currentCategory];
    const display = document.getElementById('card-display-text'); 
    const counter = document.getElementById('card-counter');     

    if (!display || !counter) return; 

    if (!deck || deck.length === 0) {
        display.innerText = "No cards in this deck yet!";
        counter.innerText = "0 / 0";
        return;
    }

    const currentCard = deck[currentCardIndex];
    display.innerText = isShowingAnswer ? currentCard.a : currentCard.q;
    counter.innerText = `${currentCardIndex + 1} / ${deck.length}`;
    
    // This adds a nice color effect: Blue for questions, Green for answers
    display.classList.toggle('text-primary', !isShowingAnswer);
    display.classList.toggle('text-success', isShowingAnswer);
}

function flipCard() {
    if(!flashcardData[currentCategory] || flashcardData[currentCategory].length === 0) return;
    isShowingAnswer = !isShowingAnswer;
    updateCardUI();
}

function nextCard() {
    const deck = flashcardData[currentCategory];
    if (currentCardIndex < deck.length - 1) {
        currentCardIndex++;
        isShowingAnswer = false;
        updateCardUI();
    }
}

function prevCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        isShowingAnswer = false;
        updateCardUI();
    }
}

function addNewCard() {
    const q = document.getElementById('new-q').value.trim();
    const a = document.getElementById('new-a').value.trim();

    if (!q || !a) return showToast("Please fill out both the question and answer!");

    flashcardData[currentCategory].push({ q, a });
    localStorage.setItem('studyBuddyCards', JSON.stringify(flashcardData));

    document.getElementById('new-q').value = "";
    document.getElementById('new-a').value = "";
    updateCardUI();
    showToast(`Added to ${currentCategory}!`);
}

function deleteCurrentCard() {
    const deck = flashcardData[currentCategory];
    if (deck.length === 0) return;

    if (confirm(`Delete this ${currentCategory} card?`)) {
        deck.splice(currentCardIndex, 1);
        localStorage.setItem('studyBuddyCards', JSON.stringify(flashcardData));

        if (currentCardIndex >= deck.length && currentCardIndex > 0) {
            currentCardIndex = deck.length - 1;
        }

        isShowingAnswer = false;
        updateCardUI();
        showToast("Card deleted.");
    }
}

// ==========================================
// 8. FOOTER UPDATE
// ==========================================
const updateEl = document.getElementById('last-update');
if(updateEl) {
    updateEl.innerText = "Updated: " + new Date().toLocaleString();
}
    function showToast(message) {
    console.log(message); // For debugging
    alert(message); // Simple temporary replacement
}
