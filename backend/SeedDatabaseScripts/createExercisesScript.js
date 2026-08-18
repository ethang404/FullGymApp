// Run with: node seedExerciseCatalogViaEndpoint.js
// Requires axios: npm install axios
const exercises = require("./tempExercises"); // paste the same `exercises` array from seedExerciseCatalog.js into this file, module.exports = { exercises };

const BASE_URL = "http://localhost:8000"; // adjust to your running server
const TOKEN =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzg3MDY4ODcxLCJleHAiOjE3ODcwNzI0NzEsImF1ZCI6Im15LWd5bS1hcHAiLCJpc3MiOiJneW0tYXV0aC1zZXJ2ZXIifQ.XLwBbFVuSHJzj5wbv-_RTBaFZ02Xc3YSJ1TNXJ0T93c"; // needs to pass your verifyToken middleware

async function seed() {
	let createdCount = 0;
	let skippedCount = 0;

	for (const exercise of exercises) {
		try {
			const response = await fetch(`${BASE_URL}/workouts/catalog`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${TOKEN}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(exercise),
			});
			const data = await response.json();

			if (!response.ok) {
				console.log(`Skipped ${exercise.name}: ${data.message || response.statusText}`);
				skippedCount++;
				continue;
			}

			console.log(`Created: ${exercise.name}`);
			createdCount++;
		} catch (err) {
			// CreateCatalogExercise throws a DataError (400) for duplicates - safe to skip and keep going
			console.log(`Skipped ${exercise.name}: ${err.response?.data?.message || err.message}`);
			skippedCount++;
		}
	}

	console.log(`Done. Created ${createdCount}, skipped ${skippedCount}.`);
}

seed();
