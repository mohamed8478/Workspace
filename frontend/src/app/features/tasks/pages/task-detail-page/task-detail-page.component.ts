import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TASK_DEPARTMENTS, Task, TaskDepartment } from '../../models/task.model';
import { TaskApiService } from '../../services/task-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TokenService } from '../../../../core/services/token.service';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-detail-page.component.html',
  styleUrl: './task-detail-page.component.css',
})
export class TaskDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskApi = inject(TaskApiService);
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private taskId: number | null = null;

  readonly departments = TASK_DEPARTMENTS;
  readonly task = signal<Task | null>(null);
  readonly loading = signal(true);
  readonly savingSubtask = signal(false);
  readonly completingTask = signal(false);
  readonly error = signal<string | null>(null);
  readonly newSubtaskTitle = signal('');
  readonly completedSubtasks = computed(() =>
    this.task()?.subtasks.filter((subtask) => subtask.completed).length ?? 0
  );
  readonly isAdmin = computed(() => this.authService.hasRole('ADMIN'));

  ngOnInit(): void {
    const taskId = Number(this.route.snapshot.paramMap.get('taskId'));

    if (!Number.isInteger(taskId) || taskId <= 0) {
      this.loading.set(false);
      this.error.set('This task link is not valid.');
      return;
    }

    this.taskId = taskId;
    this.loadTask(taskId);
  }

  loadTask(taskId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.taskApi.getTask(taskId).subscribe({
      next: (task) => {
        this.task.set(task);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load this task.');
        this.loading.set(false);
      },
    });
  }

  updateNewSubtaskTitle(value: string): void {
    this.newSubtaskTitle.set(value);
  }

  addSubtask(): void {
    const title = this.newSubtaskTitle().trim();

    if (!title || !this.taskId || this.savingSubtask()) {
      return;
    }

    this.savingSubtask.set(true);
    this.error.set(null);

    this.taskApi.addSubtask(this.taskId, { title }).subscribe({
      next: (task) => {
        this.task.set(task);
        this.newSubtaskTitle.set('');
        this.savingSubtask.set(false);
      },
      error: () => {
        this.error.set('Could not add subtask.');
        this.savingSubtask.set(false);
      },
    });
  }

  completeSubtask(subTaskId: number): void {
    const task = this.task();

    if (!task || !this.canCompleteTask(task)) {
      return;
    }

    this.taskApi.completeSubtask(task.id, subTaskId).subscribe({
      next: (updatedTask) => this.task.set(updatedTask),
      error: () => this.error.set('Could not complete subtask.'),
    });
  }

  deleteTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.taskApi.deleteTask(task.id).subscribe({
      next: () => void this.router.navigate(['/dashboard/tasks']),
      error: () => this.error.set('Could not delete task.'),
    });
  }

  completeTask(): void {
    const task = this.task();

    if (!task || task.status === 'COMPLETED' || this.completingTask()) {
      return;
    }

    this.completingTask.set(true);
    this.error.set(null);

    this.taskApi.completeTask(task.id).subscribe({
      next: (updatedTask) => {
        this.task.set(updatedTask);
        this.completingTask.set(false);
        void this.router.navigate(['/dashboard/tasks']);
      },
      error: () => {
        this.error.set('Could not submit this task as completed.');
        this.completingTask.set(false);
      },
    });
  }

  departmentLabel(department: TaskDepartment): string {
    return this.departments.find((option) => option.value === department)?.label ?? department;
  }

  assigneeName(task: Task): string {
    return task.assignedTo?.fullName ?? 'Unassigned';
  }

  canCompleteTask(task: Task): boolean {
    const currentUserId = this.currentUserId();
    return !!currentUserId && task.assignedTo?.id === currentUserId;
  }

  formatDueDate(value: string): string {
    return new Date(value).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private currentUserId(): number | null {
    const userId = this.tokenService.decodePayload()?.userId;
    const parsed = Number(userId);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
