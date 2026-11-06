const form = document.getElementById("appointmentForm");
const message = document.getElementById("message");
const doctorSelect = document.getElementById("doctor_id");
const appointmentList = document.getElementById("appointmentList");

const dateInput = document.getElementById("appointment_date");
dateInput.min = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
).toISOString().slice(0, 10);

async function loadDoctors() {
    try {
        const response = await fetch("/api/doctors");
        if (!response.ok) throw new Error("Unable to load doctors");

        const doctors = await response.json();

        doctorSelect.replaceChildren();

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select Doctor";
        doctorSelect.appendChild(defaultOption);

        doctors.forEach(doctor => {
            const option = document.createElement("option");
            option.value = doctor.id;
            option.textContent = `${doctor.name} - ${doctor.specialty}`;
            doctorSelect.appendChild(option);
        });
    } catch (error) {
        doctorSelect.replaceChildren();
        const option = document.createElement("option");
        option.textContent = "Unable to load doctors";
        doctorSelect.appendChild(option);
        showMessage(error.message, true);
    }
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "red" : "green";
}

async function loadAppointments() {
    try {
        const response = await fetch("/api/appointments");
        if (!response.ok) throw new Error("Unable to load appointments");

        const appointments = await response.json();

        appointmentList.replaceChildren();

        if (appointments.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 7;
            cell.textContent = "No appointments found";
            row.appendChild(cell);
            appointmentList.appendChild(row);
            return;
        }

        appointments.forEach(appointment => {
            const row = document.createElement("tr");

            const values = [
                appointment.id,
                appointment.patient_name,
                appointment.doctor_name,
                appointment.appointment_date,
                appointment.appointment_time,
                appointment.status
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");

            if (appointment.status === "Booked") {
                const button = document.createElement("button");
                button.textContent = "Cancel";
                button.className = "cancel-button";
                button.type = "button";
                button.addEventListener("click", () => {
                    cancelAppointment(appointment.id);
                });
                actionCell.appendChild(button);
            } else {
                actionCell.textContent = "Cancelled";
            }

            row.appendChild(actionCell);
            appointmentList.appendChild(row);
        });
    } catch (error) {
        showMessage(error.message, true);
    }
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const appointment = {
        patient_name: document.getElementById("patient_name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        doctor_id: Number(doctorSelect.value),
        appointment_date: dateInput.value,
        appointment_time: document.getElementById("appointment_time").value,
        reason: document.getElementById("reason").value.trim()
    };

    try {
        const response = await fetch("/api/appointments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(appointment)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Booking failed");
        }

        showMessage(result.message);
        form.reset();
        dateInput.min = new Date(
            Date.now() - new Date().getTimezoneOffset() * 60000
        ).toISOString().slice(0, 10);

        await loadAppointments();
    } catch (error) {
        showMessage(error.message, true);
    }
});

async function cancelAppointment(id) {
    try {
        const response = await fetch(`/api/appointments/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Cancellation failed");
        }

        showMessage(result.message);
        await loadAppointments();
    } catch (error) {
        showMessage(error.message, true);
    }
}

document.getElementById("refreshButton").addEventListener("click", loadAppointments);

loadDoctors();
loadAppointments();