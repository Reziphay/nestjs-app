type VisibilityLabelRecord = {
  id: string;
  name: string;
  slug: string;
  targetType: string;
  priority: number;
};

type VisibilityAssignmentRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  label: VisibilityLabelRecord;
};

export function isVisibilityAssignmentActive(
  startsAt: Date,
  endsAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (startsAt.getTime() > now.getTime()) {
    return false;
  }

  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return false;
  }

  return true;
}

export function serializeActiveVisibilityLabels<
  T extends VisibilityAssignmentRecord,
>(
  assignments: T[] | undefined,
  now: Date = new Date(),
): Array<Record<string, unknown>> {
  return (assignments ?? [])
    .filter((assignment) =>
      isVisibilityAssignmentActive(assignment.startsAt, assignment.endsAt, now),
    )
    .sort((left, right) => right.label.priority - left.label.priority)
    .map((assignment) => ({
      assignmentId: assignment.id,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
      label: {
        id: assignment.label.id,
        name: assignment.label.name,
        slug: assignment.label.slug,
        targetType: assignment.label.targetType,
        priority: assignment.label.priority,
      },
    }));
}

export function getMaxActiveVisibilityPriority<
  T extends VisibilityAssignmentRecord,
>(assignments: T[] | undefined, now: Date = new Date()): number {
  return (assignments ?? []).reduce((maxPriority, assignment) => {
    if (
      !isVisibilityAssignmentActive(assignment.startsAt, assignment.endsAt, now)
    ) {
      return maxPriority;
    }

    return Math.max(maxPriority, assignment.label.priority);
  }, 0);
}
