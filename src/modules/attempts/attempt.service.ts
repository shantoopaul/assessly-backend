import { Prisma } from "../../../generated/prisma/client";
import { AssessmentStatus, AttemptStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";

export const enroll = async (candidateId: string, assessmentId: string) => {
	try {
		const attempt = await prisma.$transaction(
			async (tx) => {
				const assessment = await tx.assessment.findFirst({
					where: { id: assessmentId, deletedAt: null, status: AssessmentStatus.PUBLISHED },
				});
				if (!assessment) throw new AppError(404, "Published assessment not found");

				const active = await tx.attempt.findFirst({
					where: {
						candidateId, assessmentId,
						status: { in: [AttemptStatus.PENDING_PAYMENT, AttemptStatus.READY, AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED, AttemptStatus.UNDER_REVIEW] },
					},
				});
				if (active) throw new AppError(409, "You already have an active attempt for this assessment");

				const latest = await tx.attempt.findFirst({
					where: { candidateId, assessmentId },
					orderBy: { attemptNo: "desc" },
					select: { attemptNo: true },
				});

				return tx.attempt.create({
					data: {
						candidateId, assessmentId,
						attemptNo: (latest?.attemptNo ?? 0) + 1,
						status: assessment.feeCents > 0 ? AttemptStatus.PENDING_PAYMENT : AttemptStatus.READY,
					},
					include: {
						assessment: { select: { id: true, title: true, feeCents: true, currency: true, durationMinutes: true } },
					},
				});
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);

		await writeAuditLog(candidateId, "ATTEMPT_ENROLL", "Attempt", attempt.id, { assessmentId });
		return attempt;
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
			throw new AppError(409, "Enrollment conflicted with another request; retry once");
		}
		throw error;
	}
};