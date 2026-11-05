// =====================================
// STUDYSPARE - MAIN JAVASCRIPT
// =====================================

// 1. Connect HTML elements

const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const resourceList = document.getElementById("resourceList");
const searchInput = document.getElementById("searchInput");
const filterSubject = document.getElementById("filterSubject");
const message = document.getElementById("message");

let resources = [];

let totalDownloads = Number(
    localStorage.getItem("studySpareDownloads") || 0
);

// 2. Open IndexedDB database

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("StudySpareDB", 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("resources")) {
                db.createObjectStore("resources", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

// 3. Save resource

async function saveResource(resource) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            "resources",
            "readwrite"
        );

        transaction.objectStore("resources").add(resource);

        transaction.oncomplete = function() {
            db.close();
            resolve();
        };

        transaction.onerror = function() {
            db.close();
            reject(transaction.error);
        };
    });
}

// 4. Get saved resources

async function loadResources() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            "resources",
            "readonly"
        );

        const request = transaction
            .objectStore("resources")
            .getAll();

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };

        transaction.oncomplete = function() {
            db.close();
        };
    });
}

// 5. Update dashboard

function updateStatistics() {
    document.getElementById("totalResources").textContent =
        resources.length;

    const subjects = new Set(
        resources.map(resource => resource.subject)
    );

    document.getElementById("totalSubjects").textContent =
        subjects.size;

    document.getElementById("totalDownloads").textContent =
        totalDownloads;
}

// 6. Display resources

function displayResources() {
    const search = searchInput.value.toLowerCase().trim();
    const selectedSubject = filterSubject.value;

    const filtered = resources.filter(resource => {
        const matchesSearch =
            resource.title.toLowerCase().includes(search);

        const matchesSubject =
            selectedSubject === "" ||
            resource.subject === selectedSubject;

        return matchesSearch && matchesSubject;
    });

    resourceList.innerHTML = "";

    updateStatistics();

    if (filtered.length === 0) {
        resourceList.innerHTML =
            '<p class="empty">No resources found.</p>';
        return;
    }

    filtered.forEach(resource => {
        const card = document.createElement("div");
        card.className = "resource-card";

        const heading = document.createElement("h3");
        heading.textContent = resource.title;

        const subjectText = document.createElement("p");
        subjectText.textContent =
            "Subject: " + resource.subject;

        const typeText = document.createElement("p");
        typeText.textContent =
            "Type: " + resource.type;

        const fileText = document.createElement("p");
        fileText.textContent =
            "File: " + resource.fileName;

        const dateText = document.createElement("p");
        dateText.textContent =
            "Uploaded: " + resource.date;

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const downloadButton = document.createElement("button");
        downloadButton.textContent = "Download";

        downloadButton.addEventListener("click", function() {
            downloadResource(resource);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", function() {
            deleteResource(resource.id);
        });

        actions.append(downloadButton, deleteButton);

        card.append(
            heading,
            subjectText,
            typeText,
            fileText,
            dateText,
            actions
        );

        resourceList.appendChild(card);
    });
}

// 7. Upload resource

uploadForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    message.textContent = "";
    message.className = "";

    const title = document.getElementById("title").value.trim();
    const subject = document.getElementById("subject").value;
    const type = document.getElementById("resourceType").value;
    const file = fileInput.files[0];

    if (!title || !subject || !type || !file) {
        message.textContent =
            "Please complete all fields and select a PDF.";
        message.className = "error";
        return;
    }

    if (file.type !== "application/pdf") {
        message.textContent = "Please select a PDF file.";
        message.className = "error";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        message.textContent =
            "File is too large. Maximum size is 5 MB.";
        message.className = "error";
        return;
    }

    const uploadButton =
        document.getElementById("uploadButton");

    uploadButton.disabled = true;
    uploadButton.textContent = "Uploading...";

    const resource = {
        title: title,
        subject: subject,
        type: type,
        fileName: file.name,
        file: file,
        date: new Date().toLocaleDateString()
    };

    try {
        await saveResource(resource);

        resources = await loadResources();

        displayResources();

        uploadForm.reset();

        message.textContent =
            "Resource uploaded successfully!";

        message.className = "success";

    } catch (error) {
        console.error("Upload error:", error);

        message.textContent =
            "Upload failed: " + error.message;

        message.className = "error";

    } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = "Upload Resource";
    }
});

// 8. Download resource

function downloadResource(resource) {
    if (!resource.file) {
        message.textContent = "The saved file could not be found.";
        message.className = "error";
        return;
    }

    const url = URL.createObjectURL(resource.file);

    const link = document.createElement("a");
    link.href = url;
    link.download = resource.fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function() {
        URL.revokeObjectURL(url);
    }, 1000);

    totalDownloads++;

    localStorage.setItem(
        "studySpareDownloads",
        totalDownloads
    );

    updateStatistics();
}

// 9. Delete resource

async function deleteResource(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this resource?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const db = await openDatabase();

        await new Promise((resolve, reject) => {
            const transaction = db.transaction(
                "resources",
                "readwrite"
            );

            transaction.objectStore("resources").delete(id);

            transaction.oncomplete = resolve;
            transaction.onerror = function() {
                reject(transaction.error);
            };
        });

        db.close();

        resources = await loadResources();

        displayResources();

        message.textContent = "Resource deleted successfully.";
        message.className = "success";

    } catch (error) {
        console.error("Delete error:", error);

        message.textContent =
            "Could not delete resource: " + error.message;

        message.className = "error";
    }
}

// 10. Search and filter

searchInput.addEventListener("input", displayResources);

filterSubject.addEventListener("change", displayResources);

// 11. Start StudySpare

async function initializeApp() {
    try {
        resources = await loadResources();

        displayResources();

    } catch (error) {
        console.error("Database error:", error);

        message.textContent =
            "Could not open the database: " + error.message;

        message.className = "error";
    }
}

initializeApp();