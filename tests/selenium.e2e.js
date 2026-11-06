const { Builder, By } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const assert = require("assert");

const BASE_URL = "http://localhost:3001";

async function runTests() {
    const options = new chrome.Options();
    options.addArguments("--headless=new");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");

    const driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();

    let passed = 0;

    async function test(name, callback) {
        try {
            await callback();
            passed++;
            console.log("PASS: " + name);
        } catch (error) {
            console.log("FAIL: " + name);
            console.log(error.message);
        }
    }

    const uniqueId = Date.now();
    const patientName = "Selenium Patient " + uniqueId;
    const email = "selenium" + uniqueId + "@test.com";

    let appointmentBooked = false;

    try {
        await driver.get(BASE_URL);

        await test("TC-01 Application Launch", async () => {
            assert.ok((await driver.getCurrentUrl()).includes("localhost:3001"));
        });

        await test("TC-02 Page Title Verification", async () => {
            assert.strictEqual(
                await driver.getTitle(),
                "Hospital Appointment Management"
            );
        });

        await test("TC-03 Hospital Heading Verification", async () => {
            const heading = await driver.findElement(By.css("header h1"));
            assert.strictEqual(await heading.getText(), "CityCare Hospital");
        });

        await test("TC-04 Appointment Form Verification", async () => {
            const form = await driver.findElement(By.id("appointmentForm"));
            assert.ok(await form.isDisplayed());
        });

        await test("TC-05 Doctor List Loading", async () => {
            const doctorSelect = await driver.findElement(By.id("doctor_id"));

            await driver.wait(async () => {
                return (await doctorSelect.findElements(By.css("option"))).length > 1;
            }, 10000);

            assert.ok(
                (await doctorSelect.findElements(By.css("option"))).length > 1
            );
        });

        await test("TC-06 Appointment Time Options", async () => {
            const timeSelect = await driver.findElement(By.id("appointment_time"));

            assert.ok(
                (await timeSelect.findElements(By.css("option"))).length > 1
            );
        });

        await test("TC-07 Required Field Validation", async () => {
            const form = await driver.findElement(By.id("appointmentForm"));

            const valid = await driver.executeScript(
                "return arguments[0].checkValidity()",
                form
            );

            assert.strictEqual(valid, false);
        });

        await test("TC-08 Successful Appointment Booking", async () => {
            const doctorSelect = await driver.findElement(By.id("doctor_id"));
            const timeSelect = await driver.findElement(By.id("appointment_time"));

            const doctorValue = await driver.executeScript(
                "return Array.from(arguments[0].options).find(o => o.value !== '')?.value",
                doctorSelect
            );

            const timeValue = await driver.executeScript(
                "return Array.from(arguments[0].options).find(o => o.value !== '')?.value",
                timeSelect
            );

            assert.ok(doctorValue, "No doctor option available");
            assert.ok(timeValue, "No appointment time available");

            const dateValue = await driver.executeAsyncScript(`
                const doctorId = arguments[0];
                const timeValue = arguments[1];
                const done = arguments[arguments.length - 1];

                fetch("/api/appointments")
                    .then(response => {
                        if (!response.ok) throw new Error("Unable to load appointments");
                        return response.json();
                    })
                    .then(appointments => {
                        const today = new Date();

                        for (let i = 1; i <= 3650; i++) {
                            const date = new Date(today);
                            date.setDate(date.getDate() + i);

                            const dateValue =
                                date.getFullYear() + "-" +
                                String(date.getMonth() + 1).padStart(2, "0") + "-" +
                                String(date.getDate()).padStart(2, "0");

                            const booked = appointments.some(appointment =>
                                Number(appointment.doctor_id) === Number(doctorId) &&
                                appointment.appointment_date === dateValue &&
                                appointment.appointment_time === timeValue &&
                                appointment.status === "Booked"
                            );

                            if (!booked) {
                                done(dateValue);
                                return;
                            }
                        }

                        done(null);
                    })
                    .catch(() => done(null));
            `, doctorValue, timeValue);

            assert.ok(dateValue, "No available appointment slot found");

            await driver.findElement(By.id("patient_name")).sendKeys(patientName);
            await driver.findElement(By.id("email")).sendKeys(email);
            await driver.findElement(By.id("phone")).sendKeys("9876543210");
            await driver.findElement(By.id("reason")).sendKeys("Selenium automated test");

            await driver.executeScript(`
                arguments[0].value = arguments[1];
                arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
            `, doctorSelect, doctorValue);

            await driver.executeScript(`
                arguments[0].value = arguments[1];
                arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
            `, timeSelect, timeValue);

            const dateInput = await driver.findElement(By.id("appointment_date"));

            await driver.executeScript(`
                arguments[0].value = arguments[1];
                arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
            `, dateInput, dateValue);

            await driver.findElement(
                By.css("#appointmentForm button[type='submit']")
            ).click();

            await driver.wait(async () => {
                const text = await driver.findElement(By.id("message")).getText();
                return text.length > 0;
            }, 10000);

            const bookingMessage = await driver.findElement(By.id("message")).getText();

            assert.strictEqual(
                bookingMessage,
                "Appointment booked successfully",
                "Booking failed: " + bookingMessage
            );

            appointmentBooked = true;

            await driver.wait(async () => {
                const rows = await driver.findElements(
                    By.css("#appointmentList tr")
                );

                for (const row of rows) {
                    if ((await row.getText()).includes(patientName)) return true;
                }

                return false;
            }, 10000);
        });

        await test("TC-09 Appointment Record Display", async () => {
            assert.ok(appointmentBooked, "Appointment was not booked");

            await driver.wait(async () => {
                const rows = await driver.findElements(
                    By.css("#appointmentList tr")
                );

                for (const row of rows) {
                    if ((await row.getText()).includes(patientName)) {
                        return true;
                    }
                }

                return false;
            }, 10000);

            const rows = await driver.findElements(
                By.css("#appointmentList tr")
            );

            const found = await Promise.all(
                rows.map(async row =>
                    (await row.getText()).includes(patientName)
                )
            );

            assert.ok(found.some(Boolean), "Appointment record not displayed");
        });

        await test("TC-10 Appointment Cancellation", async () => {
            assert.ok(appointmentBooked, "Appointment was not booked");

            await driver.wait(async () => {
                const rows = await driver.findElements(
                    By.css("#appointmentList tr")
                );

                for (const row of rows) {
                    if ((await row.getText()).includes(patientName)) {
                        return true;
                    }
                }

                return false;
            }, 10000);

            const rows = await driver.findElements(
                By.css("#appointmentList tr")
            );

            let appointmentRow;

            for (const row of rows) {
                if ((await row.getText()).includes(patientName)) {
                    appointmentRow = row;
                    break;
                }
            }

            assert.ok(appointmentRow, "Booked appointment was not found");

            await appointmentRow.findElement(
                By.css("button.cancel-button")
            ).click();

            await driver.wait(async () => {
                const updatedRows = await driver.findElements(
                    By.css("#appointmentList tr")
                );

                for (const row of updatedRows) {
                    const text = await row.getText();

                    if (text.includes(patientName)) {
                        return /cancelled/i.test(text);
                    }
                }

                return false;
            }, 10000);
        });

    } finally {
        console.log("\nSelenium Results: " + passed + "/10 tests passed");
        await driver.quit();
    }
}

runTests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});