const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "hospital.db");

if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS doctors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    specialty TEXT NOT NULL
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    doctor_id INTEGER NOT NULL,
                    appointment_date TEXT NOT NULL,
                    appointment_time TEXT NOT NULL,
                    reason TEXT,
                    status TEXT DEFAULT 'Booked',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(doctor_id, appointment_date, appointment_time),
                    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
                )
            `, (err) => {
                if (err) return reject(err);

                db.get("SELECT COUNT(*) AS count FROM doctors", (err, row) => {
                    if (err) return reject(err);

                    if (row.count === 0) {
                        const doctors = [
                            ["Dr. Rajesh Kumar", "Cardiology"],
                            ["Dr. Priya Sharma", "Dermatology"],
                            ["Dr. Arjun Reddy", "Orthopedics"],
                            ["Dr. Sneha Rao", "Neurology"],
                            ["Dr. Vikram Singh", "General Medicine"]
                        ];

                        const stmt = db.prepare(
                            "INSERT INTO doctors (name, specialty) VALUES (?, ?)"
                        );

                        doctors.forEach(doctor => stmt.run(doctor));

                        stmt.finalize(err => {
                            if (err) return reject(err);
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        });
    });
}

app.get("/api/health", (req, res) => {
    res.json({ status: "OK", message: "Hospital API is running" });
});

app.get("/api/doctors", (req, res) => {
    db.all("SELECT * FROM doctors ORDER BY id", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get("/api/appointments", (req, res) => {
    const sql = `
        SELECT
            appointments.*,
            doctors.name AS doctor_name,
            doctors.specialty
        FROM appointments
        JOIN doctors ON appointments.doctor_id = doctors.id
        ORDER BY appointment_date, appointment_time
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post("/api/appointments", (req, res) => {
    const {
        patient_name,
        email,
        phone,
        doctor_id,
        appointment_date,
        appointment_time,
        reason
    } = req.body;

    if (
        !patient_name?.trim() ||
        !email?.trim() ||
        !phone?.trim() ||
        !doctor_id ||
        !appointment_date ||
        !appointment_time
    ) {
        return res.status(400).json({
            error: "Please fill all required fields"
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email address" });
    }

    if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: "Phone number must contain 10 digits" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ||
        Number.isNaN(Date.parse(appointment_date)) ||
        new Date(appointment_date).toISOString().slice(0, 10) !== appointment_date) {
        return res.status(400).json({ error: "Invalid appointment date" });
    }

    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(appointment_time)) {
        return res.status(400).json({ error: "Invalid appointment time" });
    }

    const sql = `
        INSERT INTO appointments
        (patient_name, email, phone, doctor_id, appointment_date, appointment_time, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
        sql,
        [
            patient_name.trim(),
            email.trim(),
            phone,
            doctor_id,
            appointment_date,
            appointment_time,
            reason || ""
        ],
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE")) {
                    return res.status(409).json({
                        error: "This appointment slot is already booked"
                    });
                }

                if (err.message.includes("FOREIGN KEY")) {
                    return res.status(400).json({ error: "Invalid doctor selected" });
                }

                return res.status(500).json({ error: err.message });
            }

            res.status(201).json({
                message: "Appointment booked successfully",
                appointmentId: this.lastID
            });
        }
    );
});

app.delete("/api/appointments/:id", (req, res) => {
    db.run(
        "UPDATE appointments SET status = 'Cancelled' WHERE id = ? AND status = 'Booked'",
        [req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            if (this.changes === 0) {
                return res.status(404).json({
                    error: "Appointment not found or already cancelled"
                });
            }

            res.json({ message: "Appointment cancelled successfully" });
        }
    );
});

if (require.main === module) {
    initializeDatabase()
        .then(() => {
            const PORT = process.env.PORT || 3000;
            app.listen(PORT, () => {
                console.log(`Hospital server running on port ${PORT}`);
            });
        })
        .catch(err => {
            console.error("Database initialization failed:", err);
            process.exit(1);
        });
}

module.exports = { app, db, initializeDatabase };