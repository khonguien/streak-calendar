// 1. Cấu hình (Lấy từ ảnh trước của ông)
const firebaseConfig = {
    apiKey: "AIzaSyBBk5N2H_z6pLOM-YB9_nKWUBn0qox9N0o",
    authDomain: "teamtracker-edeee.firebaseapp.com",
    databaseURL: "https://teamtracker-edeee-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "teamtracker-edeee",
    storageBucket: "teamtracker-edeee.firebasestorage.app",
    messagingSenderId: "424800634605",
    appId: "1:424800634605:web:6e613bdfa5f3d7e2886ee4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. State
let usersList = ["Khoi Nguyen", "Khách"]; 
let currentUser = localStorage.getItem('appCurrentUser') || "Khoi Nguyen";
let currentSelectedDay = new Date().getDate();
let tasksData = {};
let waterData = { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: new Date().toDateString() };

const defaultSuggestedTasks = ["💧 Uống đủ 2L nước", "🚫 Không uống đồ ngọt", "🚶 Đi đủ 7000 bước"];

// 3. Khởi tạo & Đồng bộ Real-time
function initAuth() {
    // Đồng bộ danh sách User
    db.ref('usersList').on('value', (snapshot) => {
        if (snapshot.val()) usersList = snapshot.val();
        renderUserDropdown();
    });

    // Đồng bộ Tasks (Tất cả mọi người đều thấy)
    db.ref('tasks').on('value', (snapshot) => {
        tasksData = snapshot.val() || {};
        renderCalendar();
        renderTasks(currentSelectedDay);
    });

    loadWaterData();
    renderSuggestedTasks();
}

// --- LOGIC USER ---
function renderUserDropdown() {
    const select = document.getElementById('userSelect');
    if(!select) return;
    select.innerHTML = usersList.map(u => `<option value="${u}" ${u === currentUser ? 'selected' : ''}>${u}</option>`).join('') + `<option value="ADD_NEW">➕ Thêm User mới...</option>`;
    document.getElementById("userNameDisplay").textContent = currentUser;
}

function handleUserChange() {
    const select = document.getElementById('userSelect');
    if (select.value === "ADD_NEW") {
        const name = prompt("Tên user mới:");
        if (name && !usersList.includes(name.trim())) {
            usersList.push(name.trim());
            db.ref('usersList').set(usersList);
            currentUser = name.trim();
        }
    } else {
        currentUser = select.value;
    }
    localStorage.setItem('appCurrentUser', currentUser);
    loadWaterData();
    renderUserDropdown();
}

// --- LOGIC TASKS ---
function addSpecificTask(titleText) {
    const newTask = { 
        id: "t_" + Date.now(), 
        title: `${titleText} của ${currentUser}`, 
        owner: currentUser, 
        completed: false,
        color: "blue"
    };
    db.ref(`tasks/${currentSelectedDay}`).push(newTask);
}

function toggleTask(day, key) {
    const currentStatus = tasksData[day][key].completed;
    db.ref(`tasks/${day}/${key}`).update({ completed: !currentStatus });
}

function deleteTask(day, key) {
    if(confirm("Xóa task này?")) db.ref(`tasks/${day}/${key}`).remove();
}

function renderTasks(day) {
    const taskList = document.getElementById('taskList');
    const dayData = tasksData[day] || {};
    const tasksArray = Object.values(dayData);
    
    renderProgressBars(tasksArray);
    taskList.innerHTML = "";

    if (Object.keys(dayData).length === 0) {
        taskList.innerHTML = `<p style="padding:20px; color:gray">Chưa có việc gì.</p>`;
        return;
    }

    for (let key in dayData) {
        const t = dayData[key];
        taskList.innerHTML += `
            <div class="task-item ${t.color}" style="opacity: ${t.owner === currentUser ? 1 : 0.5}">
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask(${day}, '${key}')">
                <div class="task-content">
                    <span class="task-title">${t.title}</span>
                    ${t.owner === currentUser ? `<button onclick="deleteTask(${day}, '${key}')">✕</button>` : ''}
                </div>
            </div>`;
    }
}

// --- LOGIC NƯỚC ---
function loadWaterData() {
    db.ref(`water/${currentUser}`).on('value', (snapshot) => {
        const data = snapshot.val();
        const today = new Date().toDateString();
        if (data) {
            waterData = data;
            if (waterData.lastDate !== today) {
                waterData.consumedLiters = 0; waterData.history = []; waterData.lastDate = today;
                db.ref(`water/${currentUser}`).set(waterData);
            }
        }
        updateWaterUI();
        renderWaterHistory();
    });
}

function addBottle() {
    waterData.consumedLiters += waterData.bottleVolLiters;
    if(!waterData.history) waterData.history = [];
    waterData.history.unshift({ text: `💦 +${waterData.bottleVolLiters*1000}ml`, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    db.ref(`water/${currentUser}`).set(waterData);
}

// Giữ lại các hàm render giao diện cũ của ông (renderCalendar, renderProgressBars, v.v.)
// Nhưng nhớ gọi hàm của Firebase khi cần lưu dữ liệu.

window.onload = initAuth;