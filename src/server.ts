import app from "./app";
import { config } from "./config";

async function main() {
	try {
		app.listen(config.PORT, () => {
			console.log("Server is running on PORT: ", config.PORT);
		})
	} catch(error) {
		console.error("Error starting the server: ", error);
		process.exit(1);
	}	
}

main();