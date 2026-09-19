import app from "./app";

const PORT = 5000
async function main() {
	try {
		app.listen(PORT, () => {
			console.log("Server is running on PORT: ", PORT);
		})
	} catch(error) {
		console.error("Error starting the server: ", error);
		process.exit(1);
	}	
}

main();