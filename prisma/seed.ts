import { prisma } from "../src/lib/prisma";
import { seedTestUsers } from "../src/utils/seed";

seedTestUsers()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error(error);
		await prisma.$disconnect();
		process.exit(1);
	});
