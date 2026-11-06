process.env.DB_PATH = ":memory:";

const request = require("supertest");
const { app, db, initializeDatabase } = require("../server");

beforeAll(async () => {
    await initializeDatabase();
});

afterAll(async () => {
    await new Promise((resolve, reject) => {
        db.close(err => {
            if (err) reject(err);
            else resolve();
        });
    });
});

describe("Hospital Appointment Management API", () => {

    test("Health check should return OK", async () => {
        const response = await request(app).get("/api/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("OK");
    });

    test("Should retrieve doctors", async () => {
        const response = await request(app).get("/api/doctors");

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test("Should retrieve appointments", async () => {
        const response = await request(app).get("/api/appointments");

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test("Should book an appointment", async () => {
        const response = await request(app)
            .post("/api/appointments")
            .send({
                patient_name: "Rahul Kumar",
                email: "rahul@example.com",
                phone: "9876543210",
                doctor_id: 1,
                appointment_date: "2030-05-15",
                appointment_time: "10:00",
                reason: "Regular checkup"
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe("Appointment booked successfully");
    });

    test("Should reject missing patient details", async () => {
        const response = await request(app)
            .post("/api/appointments")
            .send({
                patient_name: "",
                email: "",
                phone: ""
            });

        expect(response.statusCode).toBe(400);
    });

    test("Should reject invalid email", async () => {
        const response = await request(app)
            .post("/api/appointments")
            .send({
                patient_name: "Test Patient",
                email: "invalid-email",
                phone: "9876543210",
                doctor_id: 1,
                appointment_date: "2030-05-16",
                appointment_time: "10:00"
            });

        expect(response.statusCode).toBe(400);
    });

    test("Should reject duplicate appointment slots", async () => {
        const response = await request(app)
            .post("/api/appointments")
            .send({
                patient_name: "Another Patient",
                email: "another@example.com",
                phone: "9876543211",
                doctor_id: 1,
                appointment_date: "2030-05-15",
                appointment_time: "10:00"
            });

        expect(response.statusCode).toBe(409);
    });

    test("Should cancel an appointment", async () => {
        const response = await request(app)
            .delete("/api/appointments/1");

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("Appointment cancelled successfully");
    });

});