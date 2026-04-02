import type {
  Subtask,
  Task,
  TaskRecurringCadence,
} from "@/lib/domain/models";
import { isoToday } from "@/lib/utils";

export function isTaskDone(task: Task) {
  return task.status === "done";
}

export function getTaskReminderDate(task: Task) {
  return task.reminderAt?.slice(0, 10);
}

export function isTaskOverdue(task: Task, today = isoToday()) {
  return !isTaskDone(task) && Boolean(task.dueOn && task.dueOn < today);
}

export function isTaskDueToday(task: Task, today = isoToday()) {
  return !isTaskDone(task) && task.dueOn === today;
}

export function isTaskReminderToday(task: Task, today = isoToday()) {
  return !isTaskDone(task) && getTaskReminderDate(task) === today;
}

export function isTaskPinnedToday(task: Task) {
  return !isTaskDone(task) && Boolean(task.todayPinned);
}

export function isTaskDoneToday(task: Task, today = isoToday()) {
  return isTaskDone(task) && task.completedAt?.slice(0, 10) === today;
}

export function isTaskInToday(task: Task, today = isoToday()) {
  return (
    isTaskOverdue(task, today) ||
    isTaskDueToday(task, today) ||
    isTaskReminderToday(task, today) ||
    isTaskPinnedToday(task)
  );
}

function priorityRank(priority: Task["priority"]) {
  return {
    high: 0,
    medium: 1,
    low: 2,
  }[priority];
}

export function sortTasks(left: Task, right: Task) {
  const leftDate = left.dueOn ?? "9999-12-31";
  const rightDate = right.dueOn ?? "9999-12-31";
  const dateDiff = leftDate.localeCompare(rightDate);

  if (dateDiff !== 0) {
    return dateDiff;
  }

  const leftTime = left.startTime ?? left.dueTime ?? "99:99";
  const rightTime = right.startTime ?? right.dueTime ?? "99:99";
  const timeDiff = leftTime.localeCompare(rightTime);

  if (timeDiff !== 0) {
    return timeDiff;
  }

  const priorityDiff = priorityRank(left.priority) - priorityRank(right.priority);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return left.title.localeCompare(right.title);
}

export function getTodayTasks(tasks: Task[], today = isoToday()) {
  return tasks.filter((task) => isTaskInToday(task, today)).sort(sortTasks);
}

export function getDoneTodayTasks(tasks: Task[], today = isoToday()) {
  return tasks.filter((task) => isTaskDoneToday(task, today)).sort(sortTasks);
}

export function getUpcomingTasks(tasks: Task[], today = isoToday()) {
  return tasks
    .filter((task) => !isTaskDone(task) && Boolean(task.dueOn && task.dueOn >= today))
    .sort(sortTasks);
}

function shiftDate(dateText: string, cadence: TaskRecurringCadence, interval: number) {
  const date = new Date(dateText);

  if (cadence === "daily") {
    date.setDate(date.getDate() + interval);
  }

  if (cadence === "weekly") {
    date.setDate(date.getDate() + interval * 7);
  }

  if (cadence === "monthly") {
    date.setMonth(date.getMonth() + interval);
  }

  return date.toISOString().slice(0, 10);
}

function shiftDateTime(dateTimeText: string, cadence: TaskRecurringCadence, interval: number) {
  const [dateText, timeText = "09:00"] = dateTimeText.split("T");
  return `${shiftDate(dateText, cadence, interval)}T${timeText}`;
}

export function advanceRecurringTask(task: Task) {
  if (!task.recurring) {
    return task;
  }

  const interval = task.recurring.interval ?? 1;

  if (task.dueOn) {
    task.dueOn = shiftDate(task.dueOn, task.recurring.cadence, interval);
  }

  if (task.reminderAt) {
    task.reminderAt = shiftDateTime(task.reminderAt, task.recurring.cadence, interval);
  }

  task.status = "todo";
  task.todayPinned = false;
  task.completedAt = undefined;

  return task;
}

export function getTaskSubtaskProgress(taskId: string, subtasks: Subtask[]) {
  const taskSubtasks = subtasks.filter((subtask) => subtask.taskId === taskId);

  return {
    total: taskSubtasks.length,
    done: taskSubtasks.filter((subtask) => subtask.done).length,
  };
}
